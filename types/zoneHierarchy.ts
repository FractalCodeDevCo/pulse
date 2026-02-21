import { FieldType } from "./fieldType"

export type MacroZone =
  | "Infield"
  | "Outfield"
  | "Sidelines/Foul/Warning Track"
  | "Central"
  | "Endzones"
  | "Sidelines"
  | "Area Izq"
  | "Area Der"

type MacroMap = Record<string, string[]>

export const ZONE_HIERARCHY_BY_SPORT: Record<FieldType, MacroMap> = {
  beisbol: {
    Infield: ["Infield"],
    Outfield: ["Outfield"],
    "Sidelines/Foul/Warning Track": ["Sidelines/Foul/Warning Track"],
  },
  softbol: {
    Infield: ["Infield"],
    Outfield: ["Outfield"],
    "Sidelines/Foul/Warning Track": ["Sidelines/Foul/Warning Track"],
  },
  football: {
    Central: ["Central"],
    Endzones: ["Endzones"],
    Outfield: ["Outfield"],
    Sidelines: ["Sidelines"],
  },
  soccer: {
    Central: ["Central"],
    "Area Izq": ["Area Izq"],
    "Area Der": ["Area Der"],
  },
}

export function getMacroZoneOptions(fieldType: FieldType): Array<{ value: MacroZone; label: string }> {
  const map = ZONE_HIERARCHY_BY_SPORT[fieldType]
  return Object.keys(map).map((macro) => ({ value: macro as MacroZone, label: macro }))
}

export function getMicroZoneOptions(fieldType: FieldType, macroZone: string): string[] {
  return ZONE_HIERARCHY_BY_SPORT[fieldType]?.[macroZone] ?? []
}
