export type PlanFileRef = {
  name: string
  url?: string
  contentType?: string
  size?: number
}

export type PlanPageKind =
  | "blueprint_clean"
  | "blueprint_dimensions"
  | "roll_layout"
  | "legend"
  | "unknown"

export type ZoneKey =
  | "outfield"
  | "infield"
  | "warning_track"
  | "sideline"
  | "endzone"
  | "generic"

export type RollZoneMapEntry = {
  zoneKey: ZoneKey
  labels: string[]
  totalLinearFt: number | null
}

export type PlanPageCandidate = {
  id: string
  sourceFile: string
  pageIndex: number
  kind: PlanPageKind
  confidence: number
  signals: string[]
}

export type DetectedRoll = {
  label: string
  totalLinearFt: number | null
  segmentCount: number
  chopCount: number
  splitCount: number
  sourceFiles: string[]
}

export type PlanStats = {
  uniqueRollLabels: number
  rollSegments: number
  choppedSegments: number
  splitSegments: number
  totalLinearFt: number | null
  avgLinearFtPerRoll: number | null
}

export type RollLengthValue = {
  raw: string
  feet: number
}

export type RollBBox = {
  page: number
  x0: number
  y0: number
  x1: number
  y1: number
}

export type ParsedRollSegment = {
  instanceId: string
  id: string
  length: RollLengthValue | null
  bbox: RollBBox
  zone: ZoneKey | "foul_territory" | "bullpen" | "unknown"
  flags: string[]
  sourceText: string
  sourceFile: string
}

export type RollAdjacencyRow = {
  instanceId: string
  id: string
  neighbors: Array<{
    instanceId: string
    id: string
    distance: number
  }>
}

export type ParsedPlanRollLayout = {
  rolls: ParsedRollSegment[]
  pileDirection: string | null
  orientation: "left_to_right" | "top_to_bottom" | "unknown"
  adjacency: RollAdjacencyRow[]
  notes: string[]
}

export type PlanAnalysisResult = {
  projectId: string
  status: "scaffold" | "parsed"
  version: "v0"
  createdAt: string
  pages: PlanPageCandidate[]
  manualRollLayoutPages?: Record<string, number>
  detectedRolls: DetectedRoll[]
  stats: PlanStats
  rollZoneMap: RollZoneMapEntry[]
  rollLayout?: ParsedPlanRollLayout
  notes: string[]
  nextActions: string[]
}
