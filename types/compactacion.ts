import { FieldType } from "./fieldType"
import { Zone } from "./zones"

export enum CompactionMethod {
  PLACA = "PLACA",
  RODILLO = "RODILLO",
  MANUAL = "MANUAL",
}

export enum LevelingStatus {
  SI = "SI",
  NO = "NO",
}

export interface CompactacionFormValues {
  zone: Zone | ""
  compactionMethod: CompactionMethod | ""
  levelingVerified: LevelingStatus | ""
  notes: string
  evidencePhoto: string | null
}

export interface CompactacionRecord {
  fieldType: FieldType
  zone: Zone
  compactionMethod: CompactionMethod
  levelingVerified: LevelingStatus
  notes?: string
  evidencePhoto: string
  timestamp: string
}
