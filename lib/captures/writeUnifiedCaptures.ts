import { getSupabaseAdminClient } from "../supabase/server"

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>

export type UnifiedCaptureInsert = {
  projectId: string
  phase: string
  imageUrl: string
  timestamp?: string | null
  crew?: string | null
  projectZoneId?: string | null
  captureSessionId?: string | null
  captureStatus?: string | null
  fieldType?: string | null
  macroZone?: string | null
  microZone?: string | null
  zoneType?: string | null
  zone?: string | null
  notes?: string | null
  feetInstalled?: number | null
  rollsUsed?: number | null
  glueBuckets?: number | null
  seams?: number | null
  rollLengthFit?: string | null
  compactionMethod?: string | null
  compactionSurfaceFirm?: boolean | null
  qualityLabel?: string | null
  sourceTable?: string | null
  sourceId?: string | null
  photoType?: string | null
  metadata?: Record<string, unknown> | null
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
    .map((capture) => ({
      project_id: capture.projectId,
      phase: mapWorkflowPhaseToUnified(capture.phase),
      image_url: capture.imageUrl,
      timestamp: capture.timestamp ?? new Date().toISOString(),
      crew: capture.crew ?? null,
      project_zone_id: capture.projectZoneId ?? null,
      capture_session_id: capture.captureSessionId ?? null,
      capture_status: capture.captureStatus ?? null,
      field_type: capture.fieldType ?? null,
      macro_zone: capture.macroZone ?? null,
      micro_zone: capture.microZone ?? null,
      zone_type: capture.zoneType ?? null,
      zone: capture.zone ?? null,
      notes: capture.notes ?? null,
      feet_installed: capture.feetInstalled ?? null,
      rolls_used: capture.rollsUsed ?? null,
      glue_buckets: capture.glueBuckets ?? null,
      seams: capture.seams ?? null,
      roll_length_fit: capture.rollLengthFit ?? null,
      compaction_method: capture.compactionMethod ?? null,
      compaction_surface_firm: capture.compactionSurfaceFirm ?? null,
      quality_label: capture.qualityLabel ?? null,
      source_table: capture.sourceTable ?? null,
      source_id: capture.sourceId ?? null,
      photo_type: capture.photoType ?? null,
      metadata: capture.metadata ?? {},
    }))

  if (rows.length === 0) return

  const result = await params.supabase.from("captures").insert(rows)
  if (result.error && !isMissingRelationOrColumnError(result.error.message)) {
    throw new Error(result.error.message)
  }
}
