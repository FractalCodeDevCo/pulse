import { FieldType } from "./fieldType"
import { MacroZone } from "./zoneHierarchy"

export enum PhaseStatus {
  COMPACTING = "COMPACTING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export enum CompactionType {
  PLATE = "PLATE",
  ROLLER = "ROLLER",
  MANUAL = "MANUAL",
}

export enum RollLengthStatus {
  NORMAL = "NORMAL",
  JUSTO = "JUSTO",
  MAJOR_MISMATCH = "MAJOR_MISMATCH",
}

export interface RollosFormValues {
  macroZone: MacroZone | ""
  microZone: string
  zone: string
  totalRolls: string
  totalSeams: string
  phaseStatus: PhaseStatus | ""
  compactionType: CompactionType | ""
  surfaceFirm: boolean
  moistureOk: boolean
  doubleCompaction: boolean
  rollLengthStatus: RollLengthStatus | ""
  photos: string[]
  observations: string
}

export interface RollosRecord {
  id?: string
  projectId: string
  fieldType: FieldType
  zone: string
  macro_zone: MacroZone
  micro_zone: string
  totalRolls: number
  totalSeams: number
  phaseStatus: PhaseStatus
  compactionType: CompactionType
  surfaceFirm: boolean
  moistureOk: boolean
  doubleCompaction: boolean
  rollLengthStatus: RollLengthStatus
  photos: string[]
  observations?: string
  timestamp: string
}

export interface RollosRow {
  id: string
  zone_id: string
  project_id: string | null
  field_type: string | null
  total_rolls: number
  total_seams: number
  phase_status: PhaseStatus
  compaction_type: CompactionType
  surface_firm: boolean
  moisture_ok: boolean
  double_compaction: boolean
  roll_length_status: RollLengthStatus
  observations: string | null
  created_at: string
  rollos_photos: Array<{ image_url: string }> | null
}
