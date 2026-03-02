import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type IncidenceRequestBody = {
  project_id?: string
  project_zone_id?: string
  field_type?: string
  macro_zone?: string
  micro_zone?: string
  zone_type?: string
  type_of_incidence?: string
  impact_level?: string
  priority_level?: string
  photos?: string[]
  note?: string
}

const DEBUG_CAPTURE = process.env.NEXT_PUBLIC_DEBUG_CAPTURE === "1" || process.env.DEBUG_CAPTURE === "1"

function log(event: string, data: Record<string, unknown>) {
  if (!DEBUG_CAPTURE) return
  console.log(`[incidences-api] ${event}`, data)
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

function isSchemaCompatibilityError(message: string): boolean {
  return isMissingColumnError(message) || isMissingRelationError(message)
}

function normalizeIncidentType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (lower.includes("longitud")) return "wrong_roll"
  if (lower.includes("costura") && lower.includes("retrabajo")) return "rework"
  if (lower.includes("costura")) return "rework"
  if (lower.includes("material")) return "other"
  if (lower.includes("compact")) return "other"
  if (lower.includes("maquinaria")) return "machine_delay"
  return "other"
}

function normalizeSeverity(priority: string): "low" | "med" | "high" {
  const lower = priority.trim().toLowerCase()
  if (lower.includes("fuerte")) return "high"
  if (lower.includes("moderado")) return "med"
  if (lower.includes("menor")) return "med"
  return "low"
}

async function uploadDataUrl(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dataUrlOrUrl: string,
  projectId: string,
  keyPath: string,
): Promise<string> {
  if (!dataUrlOrUrl.startsWith("data:image/")) return dataUrlOrUrl

  const parsed = parseDataUrl(dataUrlOrUrl)
  if (!parsed) return dataUrlOrUrl

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const extension = parsed.mimeType.split("/")[1] || "jpg"
  const safeKeyPath = keyPath.replace(/[^a-z0-9-_/.]/gi, "_")
  const filePath = `${projectId}/incidences/${Date.now()}-${safeKeyPath}.${extension}`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as IncidenceRequestBody

    if (
      !body.project_id ||
      !body.type_of_incidence ||
      !body.macro_zone ||
      !body.micro_zone ||
      !body.priority_level
    ) {
      return NextResponse.json({ error: "Missing required incidence fields" }, { status: 400 })
    }

    const sourcePhotos = Array.isArray(body.photos) ? body.photos.filter((p) => typeof p === "string") : []
    if (sourcePhotos.length < 1 || sourcePhotos.length > 3) {
      return NextResponse.json({ error: "Photos must be between 1 and 3" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const photoUrls: string[] = []

    for (let index = 0; index < sourcePhotos.length; index += 1) {
      photoUrls.push(await uploadDataUrl(supabase, sourcePhotos[index], body.project_id, `incidence_${index}`))
    }

    const payload = {
      project_id: body.project_id,
      project_zone_id: body.project_zone_id ?? null,
      module: "incidence",
      macro_zone: body.macro_zone,
      micro_zone: body.micro_zone,
      zone_type: body.zone_type ?? null,
      type_of_incidence: body.type_of_incidence,
      impact_level: body.impact_level ?? body.priority_level,
      photos: photoUrls,
      note: body.note ?? "",
      timestamp: new Date().toISOString(),
    }

    log("insert_attempt", {
      projectId: body.project_id,
      macroZone: body.macro_zone,
      microZone: body.micro_zone,
      photosCount: photoUrls.length,
    })

    const { data, error } = await supabase
      .from("incidences")
      .insert({
        project_id: body.project_id,
        project_zone_id: body.project_zone_id ?? null,
        field_type: body.field_type ?? null,
        macro_zone: body.macro_zone,
        micro_zone: body.micro_zone,
        zone_type: body.zone_type ?? null,
        type_of_incidence: body.type_of_incidence,
        priority_level: body.priority_level,
        impact_level: body.impact_level ?? body.priority_level,
        photos: photoUrls,
        note: body.note ?? null,
        payload,
      })
      .select("id, project_id, macro_zone, micro_zone, type_of_incidence, priority_level, created_at")
      .single()

    if (error) {
      console.error("[incidences-api] insert_failed", {
        error: error.message,
        projectId: body.project_id,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const incidentType = normalizeIncidentType(body.type_of_incidence)
    const incidentSeverity = normalizeSeverity(body.priority_level)
    const incidentInsert = await supabase
      .from("incidents")
      .insert({
        project_id: body.project_id,
        zone_id: body.project_zone_id ?? null,
        type: incidentType,
        severity: incidentSeverity,
        photos: photoUrls,
        notes: body.note ?? null,
      })
      .select("id")
      .single()

    if (incidentInsert.error && !isSchemaCompatibilityError(incidentInsert.error.message)) {
      console.error("[incidences-api] incidents_insert_failed", {
        error: incidentInsert.error.message,
        projectId: body.project_id,
      })
    }

    log("insert_success", { id: data.id, projectId: data.project_id })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    console.error("[incidences-api] unexpected_error", { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
