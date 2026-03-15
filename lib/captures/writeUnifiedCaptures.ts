import { getSupabaseAdminClient } from "../supabase/server"

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>

export type UnifiedCaptureInsert = {
  projectId: string
  phase: string
  imageUrl: string
  timestamp?: string | null
  crew?: string | null
  zone?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
  }
  return null
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (normalized === "true") return true
      if (normalized === "false") return false
    }
  }
  return null
}

function normalizeCaptureMetadata(metadata: Record<string, unknown> | null | undefined) {
  const root = metadata ?? {}
  const payload = isRecord(root.payload) ? root.payload : {}
  const compaction = isRecord(root.compaction) ? root.compaction : {}

  return {
    module: pickString(root, ["module"]),
    fieldType: pickString(root, ["fieldType", "field_type"]) ?? pickString(payload, ["fieldType", "field_type"]),
    projectZoneId:
      pickString(root, ["projectZoneId", "project_zone_id"]) ?? pickString(payload, ["projectZoneId", "project_zone_id"]),
    captureSessionId:
      pickString(root, ["captureSessionId", "capture_session_id"]) ??
      pickString(payload, ["captureSessionId", "capture_session_id"]),
    captureStatus:
      pickString(root, ["captureStatus", "capture_status"]) ?? pickString(payload, ["captureStatus", "capture_status"]),
    macroZone: pickString(root, ["macroZone", "macro_zone"]) ?? pickString(payload, ["macroZone", "macro_zone"]),
    microZone: pickString(root, ["microZone", "micro_zone"]) ?? pickString(payload, ["microZone", "micro_zone"]),
    stepKey: pickString(root, ["stepKey", "step_key"]) ?? pickString(payload, ["stepKey", "step_key"]),
    conditionLabel: pickString(payload, ["condicion", "condition"]),
    feetInstalled: pickNumber(root, ["feetInstalled", "feet_installed"]) ?? pickNumber(payload, ["ftTotales", "ft_totales", "ft"]),
    glueBuckets:
      pickNumber(root, ["glueBuckets", "glue_buckets"]) ?? pickNumber(payload, ["botesUsados", "botes_usados", "botes"]),
    totalRollsUsed:
      pickNumber(root, ["totalRollsUsed", "total_rolls_used"]) ??
      pickNumber(payload, ["totalRollsUsed", "total_rolls_used", "totalRolls"]),
    totalSeams: pickNumber(root, ["totalSeams", "total_seams"]) ?? pickNumber(payload, ["totalSeams", "total_seams", "seams"]),
    rollLengthFit: pickString(root, ["rollLengthFit", "roll_length_fit"]) ?? pickString(payload, ["rollLengthFit", "roll_length_fit"]),
    compactionMethod: pickString(root, ["compactionMethod", "compaction_method"]) ?? pickString(compaction, ["method", "compactionMethod"]),
    compactionSurfaceFirm:
      pickBoolean(root, ["compactionSurfaceFirm", "compaction_surface_firm"]) ?? pickBoolean(compaction, ["surfaceFirm"]),
    compactionMoistureOk:
      pickBoolean(root, ["compactionMoistureOk", "compaction_moisture_ok"]) ?? pickBoolean(compaction, ["moistureOk"]),
    compactionDouble:
      pickBoolean(root, ["compactionDouble", "compaction_double"]) ?? pickBoolean(compaction, ["doubleCompaction"]),
  }
}

function isMissingRelationOrColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return (lower.includes("relation") || lower.includes("column")) && lower.includes("does not exist")
}

export function mapWorkflowPhaseToUnified(phaseLike: string | null | undefined): string {
  const phase = phaseLike?.trim().toUpperCase() ?? ""
  if (!phase) return "other"
  if (phase.includes("COMPACT")) return "compaction"
  if (phase === "LAYOUT_GENERAL" || phase === "LAYOUT" || phase === "ALIGN") return "align"
  if (phase === "CUT") return "cut"
  if (phase === "ADHESIVE" || phase === "GLUE" || phase === "PEGADA") return "glue"
  if (phase === "ROLL_PLACEMENT" || phase.includes("ROLADO") || phase === "ROLL_INSTALL") return "roll_install"
  if (phase === "ROLL_VERIFY" || phase === "ROLL_VERIFICATION" || phase === "VERIFY" || phase === "VERIFICATION") return "verify"
  if (phase === "SEWING") return "sewing"
  if (phase === "MATERIAL" || phase === "MATERIAL_FINAL") return "material"
  if (phase === "INCIDENCE" || phase === "INCIDENT") return "incident"
  return phase.toLowerCase()
}

export async function writeUnifiedCaptures(params: {
  supabase: SupabaseAdminClient
  captures: UnifiedCaptureInsert[]
}): Promise<void> {
  const rows = params.captures
    .filter((capture) => capture.projectId && capture.phase && capture.imageUrl)
    .map((capture) => {
      const metadata = capture.metadata ?? {}
      const normalized = normalizeCaptureMetadata(metadata)

      return {
        project_id: capture.projectId,
        phase: mapWorkflowPhaseToUnified(capture.phase),
        image_url: capture.imageUrl,
        timestamp: capture.timestamp ?? new Date().toISOString(),
        crew: capture.crew ?? null,
        zone: capture.zone ?? normalized.microZone ?? normalized.macroZone ?? null,
        notes: capture.notes ?? null,
        module: normalized.module,
        field_type: normalized.fieldType,
        project_zone_id: normalized.projectZoneId,
        capture_session_id: normalized.captureSessionId,
        capture_status: normalized.captureStatus ?? "complete",
        macro_zone: normalized.macroZone,
        micro_zone: normalized.microZone,
        flow_step_key: normalized.stepKey,
        condition_label: normalized.conditionLabel,
        feet_installed: normalized.feetInstalled,
        glue_buckets: normalized.glueBuckets,
        total_rolls_used: normalized.totalRollsUsed,
        total_seams: normalized.totalSeams,
        roll_length_fit: normalized.rollLengthFit,
        compaction_method: normalized.compactionMethod,
        compaction_surface_firm: normalized.compactionSurfaceFirm,
        compaction_moisture_ok: normalized.compactionMoistureOk,
        compaction_double: normalized.compactionDouble,
        metadata,
      }
    })

  if (rows.length === 0) return

  const result = await params.supabase.from("captures").insert(rows)
  if (result.error && !isMissingRelationOrColumnError(result.error.message)) {
    throw new Error(result.error.message)
  }
}
