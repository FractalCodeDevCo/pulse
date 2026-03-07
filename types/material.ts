import { FieldType } from "./fieldType"

export type MaterialKind = "Arena" | "Goma"
export type PassType = "Sencilla" | "Doble"
export type StatusColor = "verde" | "amarillo" | "rojo"

export interface MaterialRecordInput {
  projectId: string
  fieldType: FieldType
  tipoMaterial: MaterialKind
  tipoPasada: PassType
  valvula: 1 | 2 | 3 | 4 | 5 | 6
  bolsasEsperadas: number
  bolsasUtilizadas: number
  observaciones?: string
  fotos: string[]
}

export interface MaterialRecordDb {
  id: string
  created_at: string
  project_id: string
  field_type: string | null
  tipo_material: string
  tipo_pasada: string
  valvula: number
  bolsas_esperadas: number
  bolsas_utilizadas: number
  desviacion: number
  status_color: StatusColor
  sugerencia: string | null
  fotos: string[]
  observaciones: string | null
}
