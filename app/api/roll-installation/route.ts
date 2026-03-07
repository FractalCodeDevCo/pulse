import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { computeCompactionRisk, computeRollInstallRisk, normalizeSemaforo } from "../../../lib/metricsV0"
import { uploadDataUrlToStorage } from "../../../lib/storage/safeUpload"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { resolveZoneRecordType, validatePhaseByZoneType } from "../../../lib/zonePhaseRules"

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

async function uploadPhoto(projectRecordId: string, type: PhotoType, source: string): Promise<string> {
  const supabase = getSupabaseAdminClient()
  return uploadDataUrlToStorage({
    supabase,
    dataUrlOrUrl: source,
    projectId: projectRecordId,
    moduleName: "roll-installation",
    keyPath: type,
    fallbackToOriginal: true,
  })
}

function normalizeCaptureStatus(value: unknown): CaptureStatus {
  return value === "incomplete" ? "incomplete" : "complete"
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null
  return value
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
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as RequestBody
    const photoTypes: PhotoType[] = ["compacting", "in_progress", "completed"]
    const requestedStatus = normalizeCaptureStatus(body.capture_status)
    const isCompleteCapture = requestedStatus === "complete"
    const zoneRecordType = resolveZoneRecordType(body.zone_type)
    const phaseValidation = validatePhaseByZoneType({
      zoneRecordType,
      phase: "ROLL_PLACEMENT",
    })
    if (!phaseValidation.ok) {
      return NextResponse.json({ error: phaseValidation.error }, { status: 400 })
    }

    const normalizedRollLengthFit =
      typeof body.roll_length_fit === "string" && body.roll_length_fit.trim().length > 0
        ? body.roll_length_fit
        : isCompleteCapture
          ? ""
          : "yellow"
    const normalizedTotalRollsUsed = toNonNegativeInt(body.total_rolls_used) ?? 0
    const normalizedTotalSeams = toNonNegativeInt(body.total_seams) ?? 0
    const normalizedSurfaceFirm =
      typeof body.compaction_surface_firm === "boolean"
        ? body.compaction_surface_firm
        : isCompleteCapture
          ? null
          : true
    const normalizedMoistureOk =
      typeof body.compaction_moisture_ok === "boolean"
        ? body.compaction_moisture_ok
        : isCompleteCapture
          ? null
          : true
    const normalizedDoubleCompaction =
      typeof body.compaction_double === "boolean"
        ? body.compaction_double
        : isCompleteCapture
          ? null
          : false
    const normalizedCompactionMethod =
      typeof body.compaction_method === "string" && body.compaction_method.trim().length > 0
        ? body.compaction_method
        : isCompleteCapture
          ? ""
          : "Manual"

    if (
      !body.project_id ||
      !body.project_zone_id ||
      !body.capture_session_id ||
      !body.zone ||
      (isCompleteCapture &&
        (!normalizedRollLengthFit ||
          normalizedSurfaceFirm === null ||
          normalizedMoistureOk === null ||
          normalizedDoubleCompaction === null ||
          !normalizedCompactionMethod))
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (body.total_rolls_used !== undefined && toNonNegativeInt(body.total_rolls_used) === null) {
      return NextResponse.json({ error: "total_rolls_used must be an integer >= 0" }, { status: 400 })
    }
    if (body.total_seams !== undefined && toNonNegativeInt(body.total_seams) === null) {
      return NextResponse.json({ error: "total_seams must be an integer >= 0" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const rollSem = normalizeSemaforo(normalizedRollLengthFit) as TrafficLight
    const wrongRollIncident = await hasWrongRollIncident(supabase, body.project_id, body.project_zone_id)
    const rollRisk = computeRollInstallRisk({
      rollLengthSem: rollSem,
      seamsCount: normalizedTotalSeams,
      hasWrongRollIncident: wrongRollIncident,
    })
    const compactionRisk = computeCompactionRisk({
      surfaceFirm: Boolean(normalizedSurfaceFirm),
      moistureOk: Boolean(normalizedMoistureOk),
      doubleCompaction: Boolean(normalizedDoubleCompaction),
      method: normalizedCompactionMethod,
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

    const captureStatus = requestedStatus
    const baseRow = {
      id,
      project_id: body.project_id,
      project_zone_id: body.project_zone_id,
      field_type: body.field_type ?? null,
      macro_zone: body.macro_zone ?? null,
      micro_zone: body.micro_zone ?? null,
      zone_type: body.zone_type ?? null,
      zone: body.zone,
      roll_length_fit: normalizedRollLengthFit,
      total_rolls_used: normalizedTotalRollsUsed,
      total_seams: normalizedTotalSeams,
      compaction_surface_firm: Boolean(normalizedSurfaceFirm),
      compaction_moisture_ok: Boolean(normalizedMoistureOk),
      compaction_double: Boolean(normalizedDoubleCompaction),
      compaction_method: normalizedCompactionMethod,
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
      seams_count: normalizedTotalSeams,
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
      surface_firm: Boolean(normalizedSurfaceFirm),
      moisture_ok: Boolean(normalizedMoistureOk),
      double_compaction: Boolean(normalizedDoubleCompaction),
      method: normalizedCompactionMethod,
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
