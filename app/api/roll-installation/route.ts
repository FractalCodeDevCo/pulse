import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { computeCompactionRisk, computeRollInstallRisk, normalizeSemaforo } from "../../../lib/metricsV0"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type PhotoType = "compacting" | "in_progress" | "completed"
type IncomingPhotos = Record<PhotoType, string | undefined>

type RequestBody = {
  project_id?: string | null
  project_zone_id?: string | null
  field_type?: string | null
  macro_zone?: string | null
  micro_zone?: string | null
  zone_type?: string | null
  zone?: string
  roll_length_fit?: string
  total_rolls_used?: number
  total_seams?: number
  compaction_surface_firm?: boolean
  compaction_moisture_ok?: boolean
  compaction_double?: boolean
  compaction_method?: string
  capture_session_id?: string | null
  capture_status?: "incomplete" | "complete" | null
  photos?: IncomingPhotos
}

type CaptureStatus = "incomplete" | "complete"
type TrafficLight = "green" | "yellow" | "red"
type UploadedPhoto = { type: PhotoType; url: string }

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

async function uploadPhoto(projectRecordId: string, type: PhotoType, source: string): Promise<string> {
  if (!source.startsWith("data:image/")) return source
  const parsed = parseDataUrl(source)
  if (!parsed) return source

  const supabase = getSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const filePath = `roll-installation/${projectRecordId}/${type}.jpg`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}

function normalizeCaptureStatus(value: unknown): CaptureStatus {
  return value === "incomplete" ? "incomplete" : "complete"
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

function hasOnConflictConstraintError(message: string): boolean {
  return message.toLowerCase().includes("there is no unique or exclusion constraint matching the on conflict specification")
}

function hasSchemaCacheColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("schema cache") && lower.includes("could not find the")
}

function isSchemaCompatibilityError(message: string): boolean {
  return (
    isMissingColumnError(message) ||
    isMissingRelationError(message) ||
    hasOnConflictConstraintError(message) ||
    hasSchemaCacheColumnError(message)
  )
}

async function hasWrongRollIncident(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  projectId: string,
  projectZoneId: string,
): Promise<boolean> {
  const result = await supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("zone_id", projectZoneId)
    .in("type", ["wrong_roll", "longitud_de_rollo_incorrecta"])

  if (result.error) {
    if (!isSchemaCompatibilityError(result.error.message)) {
      console.error("[roll-installation-api] incident_lookup_failed", {
        error: result.error.message,
        projectId,
        projectZoneId,
      })
    }
    return false
  }

  return (result.count ?? 0) > 0
}

function buildSummary(
  rollSem: TrafficLight,
  rollRiskScore: number,
  compactionRiskScore: number,
  compactionTraffic: TrafficLight,
  seamsPenalty: number,
  hasWrongRoll: boolean,
) {
  return {
    module: "roll-installation",
    roll_length_sem: rollSem,
    roll_risk_score: rollRiskScore,
    compaction_risk_score: compactionRiskScore,
    compaction_traffic: compactionTraffic,
    seams_penalty: seamsPenalty,
    wrong_roll_incident: hasWrongRoll,
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody
    const photoTypes: PhotoType[] = ["compacting", "in_progress", "completed"]
    if (
      !body.project_id ||
      !body.project_zone_id ||
      !body.capture_session_id ||
      !body.zone ||
      !body.roll_length_fit ||
      typeof body.total_rolls_used !== "number" ||
      typeof body.total_seams !== "number" ||
      typeof body.compaction_surface_firm !== "boolean" ||
      typeof body.compaction_moisture_ok !== "boolean" ||
      typeof body.compaction_double !== "boolean" ||
      !body.compaction_method
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (body.total_rolls_used < 0 || !Number.isInteger(body.total_rolls_used)) {
      return NextResponse.json({ error: "total_rolls_used must be an integer >= 0" }, { status: 400 })
    }
    if (body.total_seams < 0 || !Number.isInteger(body.total_seams)) {
      return NextResponse.json({ error: "total_seams must be an integer >= 0" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const rollSem = normalizeSemaforo(body.roll_length_fit) as TrafficLight
    const wrongRollIncident = await hasWrongRollIncident(supabase, body.project_id, body.project_zone_id)
    const rollRisk = computeRollInstallRisk({
      rollLengthSem: rollSem,
      seamsCount: body.total_seams,
      hasWrongRollIncident: wrongRollIncident,
    })
    const compactionRisk = computeCompactionRisk({
      surfaceFirm: body.compaction_surface_firm,
      moistureOk: body.compaction_moisture_ok,
      doubleCompaction: body.compaction_double,
      method: body.compaction_method,
    })
    const summary = buildSummary(
      rollSem,
      rollRisk.riskScore,
      compactionRisk.riskScore,
      compactionRisk.traffic,
      rollRisk.seamsPenalty,
      wrongRollIncident,
    )

    const existingRecord = await supabase
      .from("roll_installation")
      .select("*")
      .eq("project_id", body.project_id)
      .eq("project_zone_id", body.project_zone_id)
      .eq("capture_session_id", body.capture_session_id)
      .maybeSingle()

    if (!existingRecord.error && existingRecord.data) {
      return NextResponse.json({
        ...existingRecord.data,
        summary,
      })
    }
    if (existingRecord.error && !isMissingColumnError(existingRecord.error.message)) {
      return NextResponse.json({ error: existingRecord.error.message }, { status: 500 })
    }

    const id = randomUUID()
    const uploadedPhotos: UploadedPhoto[] = []
    for (const type of photoTypes) {
      const source = body.photos?.[type]
      if (!source) continue
      const url = await uploadPhoto(id, type, source)
      uploadedPhotos.push({ type, url })
    }

    const captureStatus = normalizeCaptureStatus(body.capture_status)
    const baseRow = {
      id,
      project_id: body.project_id,
      project_zone_id: body.project_zone_id,
      field_type: body.field_type ?? null,
      macro_zone: body.macro_zone ?? null,
      micro_zone: body.micro_zone ?? null,
      zone_type: body.zone_type ?? null,
      zone: body.zone,
      roll_length_fit: body.roll_length_fit,
      total_rolls_used: body.total_rolls_used,
      total_seams: body.total_seams,
      compaction_surface_firm: body.compaction_surface_firm,
      compaction_moisture_ok: body.compaction_moisture_ok,
      compaction_double: body.compaction_double,
      compaction_method: body.compaction_method,
      capture_session_id: body.capture_session_id,
      capture_status: captureStatus,
      photos: uploadedPhotos,
    }
    const fullRow = {
      ...baseRow,
      roll_length_sem: rollSem,
      roll_risk_score: rollRisk.riskScore,
      compaction_risk_score: compactionRisk.riskScore,
      compaction_traffic: compactionRisk.traffic,
    }

    let { data, error } = await supabase
      .from("roll_installation")
      .insert(fullRow)
      .select("*")
      .single()

    if (error && isSchemaCompatibilityError(error.message)) {
      const fallback = await supabase
        .from("roll_installation")
        .insert(baseRow)
        .select("*")
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rollInstallCaptureRow = {
      project_id: body.project_id,
      zone_id: body.project_zone_id,
      seams_count: body.total_seams,
      photos: uploadedPhotos,
      capture_session_id: body.capture_session_id,
      capture_status: captureStatus,
      roll_length_sem: rollSem,
      risk_score: rollRisk.riskScore,
    }

    let rollCaptureError: { message: string } | null = null
    const rollCaptureUpsert = await supabase
      .from("captures_roll_install")
      .upsert(rollInstallCaptureRow, { onConflict: "project_id,zone_id,capture_session_id" })
      .select("id")
      .single()
    rollCaptureError = rollCaptureUpsert.error

    if (rollCaptureError && hasOnConflictConstraintError(rollCaptureError.message)) {
      const rollCaptureFallback = await supabase
        .from("captures_roll_install")
        .insert(rollInstallCaptureRow)
        .select("id")
        .single()
      rollCaptureError = rollCaptureFallback.error
    }

    if (rollCaptureError && !isSchemaCompatibilityError(rollCaptureError.message)) {
      console.error("[roll-installation-api] captures_roll_install_failed", {
        error: rollCaptureError.message,
        projectId: body.project_id,
        projectZoneId: body.project_zone_id,
      })
    }

    const compactionCaptureRow = {
      project_id: body.project_id,
      zone_id: body.project_zone_id,
      surface_firm: body.compaction_surface_firm,
      moisture_ok: body.compaction_moisture_ok,
      double_compaction: body.compaction_double,
      method: body.compaction_method,
      photos: uploadedPhotos,
      capture_session_id: body.capture_session_id,
      capture_status: captureStatus,
      compaction_risk_score: compactionRisk.riskScore,
      compaction_traffic: compactionRisk.traffic,
    }

    let compactionCaptureError: { message: string } | null = null
    const compactionCaptureUpsert = await supabase
      .from("captures_compaction")
      .upsert(compactionCaptureRow, { onConflict: "project_id,zone_id,capture_session_id" })
      .select("id")
      .single()
    compactionCaptureError = compactionCaptureUpsert.error

    if (compactionCaptureError && hasOnConflictConstraintError(compactionCaptureError.message)) {
      const compactionCaptureFallback = await supabase
        .from("captures_compaction")
        .insert(compactionCaptureRow)
        .select("id")
        .single()
      compactionCaptureError = compactionCaptureFallback.error
    }

    if (compactionCaptureError && !isSchemaCompatibilityError(compactionCaptureError.message)) {
      console.error("[roll-installation-api] captures_compaction_failed", {
        error: compactionCaptureError.message,
        projectId: body.project_id,
        projectZoneId: body.project_zone_id,
      })
    }

    console.log("[roll-installation-api] save_success", {
      id: data?.id ?? null,
      projectId: body.project_id,
      projectZoneId: body.project_zone_id,
      rollRisk: rollRisk.riskScore,
      compactionRisk: compactionRisk.riskScore,
    })

    return NextResponse.json({
      ...data,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
