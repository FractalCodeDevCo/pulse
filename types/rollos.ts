import { FieldType } from "./fieldType"
import { Zone } from "./zones"

export enum ZoneRollosStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export interface RollosFormValues {
  zone: Zone | ""
  totalRollsInstalled: string
  seamsCompleted: string
  wasteEstimated: string
  zoneStatus: ZoneRollosStatus | ""
  generalPhotos: string[]
  observations: string
  crewId: string
}

export interface RollosRecord {
  id?: string
  projectId: string
  fieldType: FieldType
  zone: Zone
  totalRollsInstalled: number
  seamsCompleted: number
  wasteEstimated?: number
  zoneStatus: ZoneRollosStatus
  generalPhotos: string[]
  observations?: string
  crewId: string
  timestamp: string
}

export interface RollosRow {
  id: string
  zone_id: Zone
  project_id: string | null
  field_type: string | null
  total_rolls_installed: number
  seams_completed: number
  waste_estimated: number | null
  zone_status: ZoneRollosStatus
  observations: string | null
  crew_id: string
  created_at: string
  rollos_photos: Array<{ image_url: string }> | null
}
