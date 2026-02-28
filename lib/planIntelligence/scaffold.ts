import {
  DetectedRoll,
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

const ROLL_PATTERN =
  /(?:CHOP\s+|SPLIT\s+)?ROLL\s+'?([A-Z0-9]+)'?\s*-\s*([0-9]{1,3}(?:'[\s-]?[0-9]{1,2}"?)?|[0-9]+(?:\.[0-9]+)?)/gi

function inferPageKind(fileName: string): { kind: PlanPageKind; confidence: number; signals: string[] } {
  const signals: string[] = []

  if (/roll|layout|color|colour|seaming/i.test(fileName)) {
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

function parseFeetNotation(raw: string): number | null {
  const normalized = raw.trim()
  const mixed = normalized.match(/^([0-9]{1,3})'[\s-]?([0-9]{1,2})"?$/)
  if (mixed) {
    const feet = Number(mixed[1])
    const inches = Number(mixed[2])
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null
    return feet + inches / 12
  }

  const plain = Number(normalized.replace(/[^0-9.]/g, ""))
  return Number.isFinite(plain) ? plain : null
}

function inferZoneFromName(fileName: string): ZoneKey {
  for (const zoneRule of ZONE_KEYWORDS) {
    if (zoneRule.patterns.some((pattern) => pattern.test(fileName))) return zoneRule.key
  }
  return "generic"
}

function inferZoneFromLength(lengthFt: number): ZoneKey {
  if (lengthFt >= 140) return "outfield"
  if (lengthFt >= 90) return "infield"
  if (lengthFt >= 60) return "sideline"
  return "warning_track"
}

function mergeZoneMaps(rows: RollZoneMapEntry[]): RollZoneMapEntry[] {
  const grouped = new Map<ZoneKey, { labels: Set<string>; totalLinearFt: number }>()

  for (const row of rows) {
    const existing = grouped.get(row.zoneKey) ?? { labels: new Set<string>(), totalLinearFt: 0 }
    for (const label of row.labels) existing.labels.add(label)
    if (typeof row.totalLinearFt === "number" && Number.isFinite(row.totalLinearFt)) {
      existing.totalLinearFt += row.totalLinearFt
    }
    grouped.set(row.zoneKey, existing)
  }

  return [...grouped.entries()].map(([zoneKey, value]) => ({
    zoneKey,
    labels: [...value.labels].sort(),
    totalLinearFt: value.totalLinearFt > 0 ? Number(value.totalLinearFt.toFixed(2)) : null,
  }))
}

function buildBaseResult(projectId: string, files: PlanFileRef[]): PlanAnalysisResult {
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

  const fallbackRows: RollZoneMapEntry[] = files.map((file) => ({
    zoneKey: inferZoneFromName(file.name),
    labels: [],
    totalLinearFt: null,
  }))

  return {
    projectId,
    status: "scaffold",
    version: "v0",
    createdAt: new Date().toISOString(),
    pages,
    detectedRolls: [],
    stats: {
      uniqueRollLabels: 0,
      rollSegments: 0,
      totalLinearFt: null,
      avgLinearFtPerRoll: null,
    },
    rollZoneMap: mergeZoneMaps(fallbackRows),
    notes: [
      "Scaffold inference uses file names by default.",
      "Upload with accessible PDF URLs to extract roll labels and lengths.",
    ],
    nextActions: [
      "Persist approved roll-zone map and wire it to Roll Placement suggestions.",
      "Add computer vision layer for precise zone assignment from plan geometry.",
    ],
  }
}

export function buildPlanAnalysisScaffold(projectId: string, files: PlanFileRef[]): PlanAnalysisResult {
  return buildBaseResult(projectId, files)
}

export async function enrichPlanAnalysisFromPdfs(
  base: PlanAnalysisResult,
  files: PlanFileRef[],
): Promise<PlanAnalysisResult> {
  const candidateFiles = files.filter(
    (file) => Boolean(file.url) && (file.contentType?.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")),
  )
  if (candidateFiles.length === 0) return base

  const { PDFParse } = await import("pdf-parse")
  const rollMap = new Map<string, DetectedRoll>()
  let segmentCount = 0

  for (const file of candidateFiles) {
    if (!file.url) continue

    try {
      const response = await fetch(file.url)
      if (!response.ok) continue
      const bytes = Buffer.from(await response.arrayBuffer())
      const parser = new PDFParse({ data: bytes })
      const text = (await parser.getText()).text
      await parser.destroy()

      let match: RegExpExecArray | null = ROLL_PATTERN.exec(text)
      while (match) {
        const label = String(match[1] ?? "").trim().toUpperCase()
        const lengthFt = parseFeetNotation(String(match[2] ?? ""))
        if (label) {
          const existing = rollMap.get(label) ?? {
            label,
            totalLinearFt: 0,
            segmentCount: 0,
            sourceFiles: [],
          }
          existing.segmentCount += 1
          if (lengthFt !== null) {
            existing.totalLinearFt = (existing.totalLinearFt ?? 0) + lengthFt
          }
          if (!existing.sourceFiles.includes(file.name)) existing.sourceFiles.push(file.name)
          rollMap.set(label, existing)
          segmentCount += 1
        }
        match = ROLL_PATTERN.exec(text)
      }
      ROLL_PATTERN.lastIndex = 0
    } catch {
      // best effort parsing
    }
  }

  const detectedRolls = [...rollMap.values()]
    .map((row) => ({
      ...row,
      totalLinearFt:
        typeof row.totalLinearFt === "number" && Number.isFinite(row.totalLinearFt)
          ? Number(row.totalLinearFt.toFixed(2))
          : null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const zoneRows: RollZoneMapEntry[] = detectedRolls.map((roll) => ({
    zoneKey: roll.totalLinearFt ? inferZoneFromLength(roll.totalLinearFt) : "generic",
    labels: [roll.label],
    totalLinearFt: roll.totalLinearFt,
  }))
  const rollZoneMap = mergeZoneMaps(zoneRows)

  const totalLinearFt = detectedRolls.reduce((sum, item) => sum + (item.totalLinearFt ?? 0), 0)
  const uniqueRollLabels = detectedRolls.length

  return {
    ...base,
    status: detectedRolls.length > 0 ? "parsed" : base.status,
    detectedRolls,
    rollZoneMap: rollZoneMap.length > 0 ? rollZoneMap : base.rollZoneMap,
    stats: {
      uniqueRollLabels,
      rollSegments: segmentCount,
      totalLinearFt: totalLinearFt > 0 ? Number(totalLinearFt.toFixed(2)) : null,
      avgLinearFtPerRoll:
        uniqueRollLabels > 0 && totalLinearFt > 0
          ? Number((totalLinearFt / uniqueRollLabels).toFixed(2))
          : null,
    },
    notes: [
      ...base.notes,
      detectedRolls.length > 0
        ? "Roll labels and lengths parsed from PDF text."
        : "No roll patterns detected in PDF text; keep manual review.",
    ],
  }
}
