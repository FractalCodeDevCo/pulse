import { FieldType } from "../types/fieldType"
import { PlanAnalysisResult, ZoneKey } from "./planIntelligence/types"
import { ZONE_HIERARCHY_BY_SPORT } from "../types/zoneHierarchy"

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

export function getSetupZones(fieldType: FieldType): string[] {
  const macros = Object.keys(ZONE_HIERARCHY_BY_SPORT[fieldType] ?? {})
  const filtered = macros.filter((zone) => zone.toLowerCase() !== "campo completo")
  if (filtered.length > 0) return filtered
  return macros
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

function inferZoneKeyFromSetupZone(fieldType: FieldType, zone: string): ZoneKey {
  const normalized = zone.trim().toLowerCase()
  if (normalized.includes("outfield")) return "outfield"
  if (normalized.includes("infield")) return "infield"
  if (normalized.includes("warning")) return "warning_track"
  if (normalized.includes("sideline") || normalized.includes("perimeter")) return "sideline"
  if (normalized.includes("endzone")) return "endzone"
  if (fieldType === "football" && normalized.includes("playing field")) return "generic"
  if (fieldType === "soccer" && normalized.includes("playing surface")) return "generic"
  if (normalized.includes("foul")) return "generic"
  if (normalized.includes("bullpen")) return "generic"
  if (normalized.includes("goal area")) return "generic"
  return "generic"
}

export function suggestZoneTargetsFromPlanAnalysis(
  fieldType: FieldType,
  current: ZoneTarget[],
  analysis: PlanAnalysisResult,
): ZoneTarget[] {
  const zoneMap = new Map(analysis.rollZoneMap.map((row) => [row.zoneKey, row]))
  const stats = analysis.stats
  const uniqueRolls = stats.uniqueRollLabels
  const totalLinearFt = stats.totalLinearFt ?? 0

  const weights = current.map((row) => {
    const normalized = row.zone.toLowerCase()
    if (normalized.includes("outfield")) return 0.52
    if (normalized.includes("infield")) return 0.24
    if (normalized.includes("warning")) return 0.1
    if (normalized.includes("foul")) return 0.08
    if (normalized.includes("bullpen")) return 0.06
    if (normalized.includes("end zone")) return 0.15
    if (normalized.includes("sideline") || normalized.includes("perimeter")) return 0.2
    if (normalized.includes("playing field") || normalized.includes("playing surface")) return 0.45
    if (normalized.includes("goal area")) return 0.175
    return 1
  })
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1

  return current.map((row, index) => {
    const key = inferZoneKeyFromSetupZone(fieldType, row.zone)
    const fromZone = zoneMap.get(key)
    const zoneRollCount = fromZone?.labels.length ?? 0
    const zoneLinearFt = fromZone?.totalLinearFt ?? 0

    const fallbackRolls =
      uniqueRolls > 0 ? Math.max(0, Math.round(uniqueRolls * (weights[index] / weightSum))) : null
    const fallbackLinearFt =
      totalLinearFt > 0 ? Math.max(0, Math.round(totalLinearFt * (weights[index] / weightSum))) : null

    const plannedRolls = row.plannedRolls ?? (zoneRollCount > 0 ? zoneRollCount : fallbackRolls)
    const plannedSqft =
      row.plannedSqft ??
      (() => {
        const linear = zoneLinearFt > 0 ? zoneLinearFt : fallbackLinearFt
        if (!linear || linear <= 0) return null
        return Math.round(linear * 15)
      })()
    const plannedSeamFt =
      row.plannedSeamFt ??
      (() => {
        if (zoneLinearFt > 0) return Math.round(zoneLinearFt * 0.88)
        if (fallbackLinearFt && fallbackLinearFt > 0) return Math.round(fallbackLinearFt * 0.88)
        if (plannedRolls && plannedRolls > 1) return plannedRolls - 1
        return null
      })()
    const plannedAdhesiveUnits =
      row.plannedAdhesiveUnits ??
      (() => {
        if (plannedSqft && plannedSqft > 0) return Math.max(0, Math.round(plannedSqft / 900))
        return null
      })()

    return {
      ...row,
      plannedSqft,
      plannedRolls,
      plannedAdhesiveUnits,
      plannedSeamFt,
    }
  })
}
