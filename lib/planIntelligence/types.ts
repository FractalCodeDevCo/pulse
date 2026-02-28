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

export type PlanAnalysisResult = {
  projectId: string
  status: "scaffold" | "parsed"
  version: "v0"
  createdAt: string
  pages: PlanPageCandidate[]
  detectedRolls: DetectedRoll[]
  stats: PlanStats
  rollZoneMap: RollZoneMapEntry[]
  notes: string[]
  nextActions: string[]
}
