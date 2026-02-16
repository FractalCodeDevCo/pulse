import { FieldType } from "./fieldType"
import { Zone } from "./zones"

export enum CompactacionType {
  GENERAL = "GENERAL",
  AJUSTE = "AJUSTE",
}

export enum TrafficLightStatus {
  GREEN = "GREEN",
  YELLOW = "YELLOW",
  RED = "RED",
}

export interface CompactacionFormValues {
  zone: Zone | ""
  compactacionType: CompactacionType | ""
  directionAlignedToRolls: boolean
  surfaceFirm: boolean
  moistureOk: boolean
  trafficLightStatus: TrafficLightStatus | ""
  photos: string[]
  observations: string
  crewId: string
}

export interface CompactacionRecord {
  id?: string
  projectId: string
  fieldType: FieldType
  zone: Zone
  compactacionType: CompactacionType
  directionAlignedToRolls: boolean
  surfaceFirm: boolean
  moistureOk: boolean
  trafficLightStatus: TrafficLightStatus
  photos: string[]
  observations?: string
  crewId: string
  timestamp: string
}

export interface CompactacionRow {
  id: string
  zone_id: Zone
  project_id: string | null
  field_type: string | null
  compactacion_type: CompactacionType
  direction_aligned_to_rolls: boolean
  surface_firm: boolean
  moisture_ok: boolean
  traffic_light_status: TrafficLightStatus
  observations: string | null
  crew_id: string
  created_at: string
  compactacion_photos: Array<{ image_url: string }> | null
}
