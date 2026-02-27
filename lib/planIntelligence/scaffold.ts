import {
  PlanAnalysisResult,
  PlanFileRef,
  PlanPageCandidate,
  PlanPageKind,
  RollZoneMapEntry,
  ZoneKey,
} from "./types"

const ZONE_KEYWORDS: Array<{ key: ZoneKey; patterns: RegExp[] }> = [
  { key: "outfield", patterns: [/outfield/i] },
  { key: "infield", patterns: [/infield/i] },
  { key: "warning_track", patterns: [/warning[\s_-]?track/i] },
  { key: "sideline", patterns: [/sideline/i] },
  { key: "endzone", patterns: [/end[\s_-]?zone/i] },
]

function inferPageKind(fileName: string): { kind: PlanPageKind; confidence: number; signals: string[] } {
  const signals: string[] = []

  if (/roll|layout|color|colour/i.test(fileName)) {
    signals.push("roll/layout keyword")
    return { kind: "roll_layout", confidence: 0.72, signals }
  }
  if (/measure|dimension|cota|medida/i.test(fileName)) {
    signals.push("dimension keyword")
    return { kind: "blueprint_dimensions", confidence: 0.68, signals }
  }
  if (/legend|key|simbolog/i.test(fileName)) {
    signals.push("legend keyword")
    return { kind: "legend", confidence: 0.64, signals }
  }
  if (/plan|plano|blueprint|field/i.test(fileName)) {
    signals.push("plan keyword")
    return { kind: "blueprint_clean", confidence: 0.55, signals }
  }

  return { kind: "unknown", confidence: 0.2, signals: ["no clear keyword"] }
}

function extractLabels(fileName: string): string[] {
  const labels = new Set<string>()
  const alphaMatches = fileName.match(/\b[A-Z]\b/g) ?? []
  const alphaNumMatches = fileName.match(/\b[A-Z]{1,3}[-_ ]?\d{1,3}\b/g) ?? []

  for (const raw of [...alphaMatches, ...alphaNumMatches]) {
    const normalized = raw.toUpperCase().replace(/\s+/g, "")
    if (normalized.length > 0) labels.add(normalized)
  }

  return [...labels].slice(0, 80)
}

function inferZoneFromName(fileName: string): ZoneKey {
  for (const zoneRule of ZONE_KEYWORDS) {
    if (zoneRule.patterns.some((pattern) => pattern.test(fileName))) return zoneRule.key
  }
  return "generic"
}

function mergeZoneMaps(rows: RollZoneMapEntry[]): RollZoneMapEntry[] {
  const grouped = new Map<ZoneKey, Set<string>>()

  for (const row of rows) {
    const existing = grouped.get(row.zoneKey) ?? new Set<string>()
    for (const label of row.labels) existing.add(label)
    grouped.set(row.zoneKey, existing)
  }

  return [...grouped.entries()].map(([zoneKey, labels]) => ({
    zoneKey,
    labels: [...labels],
  }))
}

export function buildPlanAnalysisScaffold(projectId: string, files: PlanFileRef[]): PlanAnalysisResult {
  const pages: PlanPageCandidate[] = files.map((file, index) => {
    const inferred = inferPageKind(file.name)
    return {
      id: `page_${index + 1}`,
      sourceFile: file.name,
      pageIndex: 1,
      kind: inferred.kind,
      confidence: inferred.confidence,
      signals: inferred.signals,
    }
  })

  const zoneRows: RollZoneMapEntry[] = files.map((file) => ({
    zoneKey: inferZoneFromName(file.name),
    labels: extractLabels(file.name),
  }))

  const rollZoneMap = mergeZoneMaps(zoneRows)

  return {
    projectId,
    status: "scaffold",
    version: "v0",
    createdAt: new Date().toISOString(),
    pages,
    rollZoneMap,
    notes: [
      "Scaffold inference uses file names only.",
      "No OCR/CV parsing yet. This is the contract and workflow skeleton.",
    ],
    nextActions: [
      "Add PDF page extraction and OCR for roll legend pages.",
      "Add color/roll detection from plan drawings.",
      "Persist approved roll-zone map and wire it to Roll Placement suggestions.",
    ],
  }
}
