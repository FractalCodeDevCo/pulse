import { FieldType } from "./fieldType"
import { Zone } from "./zones"

export enum TrafficLightStatus {
  GREEN = "GREEN",
  YELLOW = "YELLOW",
  RED = "RED",
}

export enum RollStatusSelection {
  JUSTO_NORMAL = "JUSTO_NORMAL",
  FALTO = "FALTO",
  SOBRO = "SOBRO",
  SOBRO_DEMASIADO = "SOBRO_DEMASIADO",
}

export interface RollLabelData {
  length: number
  color?: string
  dyeLot?: string
  rollId?: string
}

export interface RollosFormValues {
  zone: Zone | ""
  labelPhoto: string | null
  installationPhoto: string | null
  length: string
  color: string
  dyeLot: string
  rollId: string
  status: RollStatusSelection | ""
  comments: string
  manualOverride: boolean
  certifiedRoll?: boolean
}

export interface RollosRecord {
  fieldType: FieldType
  zone: Zone
  labelData: RollLabelData
  manualOverride: boolean
  status: RollStatusSelection
  trafficLightStatus: TrafficLightStatus
  comments?: string
  labelPhoto?: string
  installationPhoto?: string
  certifiedRoll?: boolean
  timestamp: string
}
