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
}

export type PlanPageCandidate = {
  id: string
  sourceFile: string
  pageIndex: number
  kind: PlanPageKind
  confidence: number
  signals: string[]
}

export type PlanAnalysisResult = {
  projectId: string
  status: "scaffold"
  version: "v0"
  createdAt: string
  pages: PlanPageCandidate[]
  rollZoneMap: RollZoneMapEntry[]
  notes: string[]
  nextActions: string[]
}
