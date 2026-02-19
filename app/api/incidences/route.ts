import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type IncidenceRequestBody = {
  project_id?: string
  field_type?: string
  macro_zone?: string
  micro_zone?: string
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
      module: "incidence",
      macro_zone: body.macro_zone,
      micro_zone: body.micro_zone,
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
        field_type: body.field_type ?? null,
        macro_zone: body.macro_zone,
        micro_zone: body.micro_zone,
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

    log("insert_success", { id: data.id, projectId: data.project_id })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    console.error("[incidences-api] unexpected_error", { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
