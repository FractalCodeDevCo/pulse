export type ZoneRecordType = "GLOBAL" | "MICRO" | "LEGACY"

export type CapturePhase =
  | "COMPACTACION_GENERAL"
  | "ROLADO_GENERAL"
  | "MATERIAL_FINAL"
  | "FOTOS_FINALES"
  | "COMPACTACION_LOCAL"
  | "ROLL_PLACEMENT"
  | "SEWING"
  | "CUT"
  | "ADHESIVE"
  | "ROLADO_LOCAL"

const GLOBAL_PHASES: CapturePhase[] = [
  "COMPACTACION_GENERAL",
  "ROLADO_GENERAL",
  "MATERIAL_FINAL",
  "FOTOS_FINALES",
]

const MICRO_PHASES: CapturePhase[] = [
  "COMPACTACION_LOCAL",
  "ROLL_PLACEMENT",
  "SEWING",
  "CUT",
  "ADHESIVE",
  "ROLADO_LOCAL",
]

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  return value.trim().toUpperCase()
}

export function resolveZoneRecordType(zoneTypeLike: unknown): ZoneRecordType {
  const normalized = normalizeText(zoneTypeLike)
  if (!normalized) return "LEGACY"
  if (normalized === "GLOBAL") return "GLOBAL"
  return "MICRO"
}

export function validatePhaseByZoneType(params: {
  zoneRecordType: ZoneRecordType
  phase: CapturePhase
}): { ok: true } | { ok: false; error: string } {
  if (params.zoneRecordType === "LEGACY") return { ok: true }

  const allowed = params.zoneRecordType === "GLOBAL" ? GLOBAL_PHASES : MICRO_PHASES
  if (allowed.includes(params.phase)) return { ok: true }

  return {
    ok: false,
    error: `Phase ${params.phase} is not allowed for zone type ${params.zoneRecordType}.`,
  }
}

export function mapCompactPhase(stepKeyLike: unknown, zoneRecordType: ZoneRecordType): CapturePhase {
  const step = normalizeText(stepKeyLike)
  if (step === "ROLADO_GENERAL") return "ROLADO_GENERAL"
  if (step === "FOTOS_FINALES") return "FOTOS_FINALES"
  if (zoneRecordType === "GLOBAL") return "COMPACTACION_GENERAL"
  return "COMPACTACION_LOCAL"
}

export function mapRollosPhase(stepKeyLike: unknown): CapturePhase {
  const step = normalizeText(stepKeyLike)
  if (step === "ROLL_PLACEMENT") return "ROLL_PLACEMENT"
  if (step === "SEWING") return "SEWING"
  if (step === "CUT") return "CUT"
  if (step === "ROLADO_GENERAL") return "ROLADO_GENERAL"
  if (step === "FOTOS_FINALES") return "FOTOS_FINALES"
  return "ROLADO_LOCAL"
}
