import { PlanAnalysisResult, ParsedRollSegment } from "./types"

export type NextRollSuggestion = {
  instanceId: string
  id: string
  zone: string
  lengthFt: number | null
}

export type NextRollSuggestionResult = {
  nextRolls: NextRollSuggestion[]
  confidence: number
  strategy: "spatial_linear" | "spatial_serpentine" | "label_fallback"
}

type SuggestOptions = {
  serpentine?: boolean
}

function centerOf(roll: ParsedRollSegment) {
  return {
    cx: (roll.bbox.x0 + roll.bbox.x1) / 2,
    cy: (roll.bbox.y0 + roll.bbox.y1) / 2,
  }
}

function normalizeToken(value: string): string {
  return value.trim().toUpperCase()
}

function spatialOrder(rolls: ParsedRollSegment[], orientation: "left_to_right" | "top_to_bottom" | "unknown", serpentine: boolean) {
  const primary = orientation === "top_to_bottom" ? "cy" : "cx"
  const secondary = orientation === "top_to_bottom" ? "cx" : "cy"
  const withCenters = rolls.map((roll) => ({ roll, ...centerOf(roll) }))
  const sorted = withCenters.sort((a, b) => (a[primary] - b[primary]) || (a[secondary] - b[secondary]))

  if (!serpentine || sorted.length < 4) return sorted.map((item) => item.roll)

  const groups: Array<Array<typeof withCenters[number]>> = []
  const threshold = 48
  for (const item of sorted) {
    const last = groups[groups.length - 1]
    if (!last) {
      groups.push([item])
      continue
    }
    const ref = last[last.length - 1]
    if (Math.abs(item[primary] - ref[primary]) <= threshold) {
      last.push(item)
    } else {
      groups.push([item])
    }
  }

  const output: ParsedRollSegment[] = []
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index].sort((a, b) => a[secondary] - b[secondary])
    if (index % 2 === 1) group.reverse()
    output.push(...group.map((item) => item.roll))
  }
  return output
}

function mapZoneKeyFromRollZone(rollZone: string): string {
  if (rollZone === "infield" || rollZone === "outfield" || rollZone === "warning_track" || rollZone === "sideline" || rollZone === "endzone") {
    return rollZone
  }
  return "generic"
}

export function suggestNextRollsByZone(
  analysis: PlanAnalysisResult,
  zoneKeys: string[],
  installedRolls: string[],
  options: SuggestOptions = {},
): NextRollSuggestionResult {
  const serpentine = options.serpentine === true
  const installed = new Set(installedRolls.map(normalizeToken))
  const rollLayout = analysis.rollLayout
  const keySet = new Set(zoneKeys)

  if (rollLayout && Array.isArray(rollLayout.rolls) && rollLayout.rolls.length > 0) {
    const filtered = rollLayout.rolls.filter((roll) => keySet.has(mapZoneKeyFromRollZone(roll.zone)))
    const ordered = spatialOrder(filtered, rollLayout.orientation ?? "unknown", serpentine)
    const pending = ordered.filter((roll) => {
      const byId = installed.has(normalizeToken(roll.id))
      const byInstance = installed.has(normalizeToken(roll.instanceId))
      return !byId && !byInstance
    })

    const nextRolls = pending.slice(0, 3).map((roll) => ({
      instanceId: roll.instanceId,
      id: roll.id,
      zone: roll.zone,
      lengthFt: roll.length?.feet ?? null,
    }))

    const confidenceBase = 0.65 + (filtered.length >= 6 ? 0.1 : 0) + (rollLayout.orientation !== "unknown" ? 0.1 : 0)
    const confidence = Math.max(0.35, Math.min(0.95, Number(confidenceBase.toFixed(2))))
    return {
      nextRolls,
      confidence,
      strategy: serpentine ? "spatial_serpentine" : "spatial_linear",
    }
  }

  const labels = new Set<string>()
  for (const key of zoneKeys) {
    const found = analysis.rollZoneMap.find((entry) => entry.zoneKey === key)
    for (const label of found?.labels ?? []) labels.add(label)
  }
  const nextRolls = [...labels]
    .filter((label) => !installed.has(normalizeToken(label)))
    .slice(0, 3)
    .map((label, index) => ({
      instanceId: `label_${index + 1}_${label}`,
      id: label,
      zone: "unknown",
      lengthFt: null,
    }))

  return {
    nextRolls,
    confidence: 0.45,
    strategy: "label_fallback",
  }
}
