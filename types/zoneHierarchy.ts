import { FieldType } from "./fieldType"

export type MacroZone =
  | "Infield"
  | "Outfield"
  | "Sidelines"
  | "Central"
  | "Endzones"
  | "Areas de Portero"
  | "Midfield"

type MacroMap = Record<string, string[]>

export const ZONE_HIERARCHY_BY_SPORT: Record<FieldType, MacroMap> = {
  beisbol: {
    Infield: ["Infield"],
    Outfield: ["Outfield"],
    Sidelines: ["Sidelines"],
  },
  softbol: {
    Infield: ["Infield"],
    Outfield: ["Outfield"],
    Sidelines: ["Sidelines"],
  },
  football: {
    Central: ["Central"],
    Endzones: ["Endzones"],
    Sidelines: ["Sidelines"],
  },
  soccer: {
    "Areas de Portero": ["Areas de Portero"],
    Midfield: ["Midfield"],
    Outfield: ["Outfield"],
  },
}

export function getMacroZoneOptions(fieldType: FieldType): Array<{ value: MacroZone; label: string }> {
  const map = ZONE_HIERARCHY_BY_SPORT[fieldType]
  return Object.keys(map).map((macro) => ({ value: macro as MacroZone, label: macro }))
}

export function getMicroZoneOptions(fieldType: FieldType, macroZone: string): string[] {
  return ZONE_HIERARCHY_BY_SPORT[fieldType]?.[macroZone] ?? []
}
