import { FieldType } from "../types/fieldType"

export type ZoneTarget = {
  zone: string
  plannedSqft: number | null
  plannedRolls: number | null
  plannedAdhesiveUnits: number | null
  plannedSeamFt: number | null
}

export type ProjectSetup = {
  totalSqft: number | null
  startDate: string | null
  crewName: string
  notes: string
  planFiles: string[]
  zoneTargets: ZoneTarget[]
  setupCompleted: boolean
}

const SETUP_ZONES_BY_FIELD_TYPE: Record<FieldType, string[]> = {
  beisbol: ["Infield", "Outfield", "Sidelines"],
  softbol: ["Infield", "Outfield", "Sidelines"],
  football: ["Central", "Endzones", "Sidelines"],
  soccer: ["Areas de Portero", "Midfield", "Outfield"],
}

export function getSetupZones(fieldType: FieldType): string[] {
  return SETUP_ZONES_BY_FIELD_TYPE[fieldType]
}

export function buildEmptyZoneTargets(fieldType: FieldType): ZoneTarget[] {
  return getSetupZones(fieldType).map((zone) => ({
    zone,
    plannedSqft: null,
    plannedRolls: null,
    plannedAdhesiveUnits: null,
    plannedSeamFt: null,
  }))
}

export function normalizeZoneTargets(fieldType: FieldType, input: unknown): ZoneTarget[] {
  const defaults = buildEmptyZoneTargets(fieldType)
  if (!Array.isArray(input)) return defaults

  const map = new Map<string, ZoneTarget>()
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (typeof row.zone !== "string" || !row.zone) continue
    map.set(row.zone, {
      zone: row.zone,
      plannedSqft: typeof row.plannedSqft === "number" ? row.plannedSqft : null,
      plannedRolls: typeof row.plannedRolls === "number" ? row.plannedRolls : null,
      plannedAdhesiveUnits: typeof row.plannedAdhesiveUnits === "number" ? row.plannedAdhesiveUnits : null,
      plannedSeamFt: typeof row.plannedSeamFt === "number" ? row.plannedSeamFt : null,
    })
  }

  return defaults.map((item) => map.get(item.zone) ?? item)
}

export function inferSetupCompleted(
  totalSqft: number | null,
  startDate: string | null,
  crewName: string,
  zoneTargets: ZoneTarget[],
): boolean {
  if (!totalSqft || totalSqft <= 0) return false
  if (!startDate) return false
  if (!crewName.trim()) return false

  return zoneTargets.every((row) => {
    return (
      typeof row.plannedSqft === "number" &&
      row.plannedSqft > 0 &&
      typeof row.plannedRolls === "number" &&
      row.plannedRolls >= 0 &&
      typeof row.plannedAdhesiveUnits === "number" &&
      row.plannedAdhesiveUnits >= 0 &&
      typeof row.plannedSeamFt === "number" &&
      row.plannedSeamFt >= 0
    )
  })
}
