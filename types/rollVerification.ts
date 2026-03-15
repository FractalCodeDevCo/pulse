import { FieldType } from "./fieldType"
import { MacroZone } from "./zoneHierarchy"

export type RollVerificationStatus = "pending" | "confirmed" | "rejected"

export type RollVerificationRecord = {
  project_id: string
  field_type: FieldType
  macro_zone: MacroZone
  micro_zone: string
  roll_color: string
  roll_feet_total: number
  roll_lot_id?: string
  label_photo: string
  status: RollVerificationStatus
  rejection_reason?: string
  timestamp: string
}
