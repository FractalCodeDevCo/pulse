import { FieldType } from "./fieldType"

export type MacroZone =
  | "Campo completo"
  | "Infield"
  | "Outfield"
  | "Foul Territory"
  | "Warning Track"
  | "Bullpen"
  | "Playing Field"
  | "End Zone A"
  | "End Zone B"
  | "Sideline A"
  | "Sideline B"
  | "Playing Surface"
  | "Goal Area A"
  | "Goal Area B"
  | "Perimeter / Sidelines"
  | "Sidelines"
  | "Central"
  | "Endzones"
  | "Areas de Portero"
  | "Midfield"

type MacroMap = Record<string, string[]>

export const ZONE_HIERARCHY_BY_SPORT: Record<FieldType, MacroMap> = {
  beisbol: {
    "Campo completo": ["Campo completo"],
    Infield: ["Infield"],
    Outfield: ["Outfield"],
    "Foul Territory": ["Foul Territory"],
    "Warning Track": ["Warning Track"],
    Bullpen: ["Bullpen"],
  },
  softbol: {
    "Campo completo": ["Campo completo"],
    Infield: ["Infield"],
    Outfield: ["Outfield"],
    "Foul Territory": ["Foul Territory"],
    "Warning Track": ["Warning Track"],
    Bullpen: ["Bullpen"],
  },
  football: {
    "Campo completo": ["Campo completo"],
    "Playing Field": ["Playing Field"],
    "End Zone A": ["End Zone A"],
    "End Zone B": ["End Zone B"],
    "Sideline A": ["Sideline A"],
    "Sideline B": ["Sideline B"],
  },
  soccer: {
    "Campo completo": ["Campo completo"],
    "Playing Surface": ["Playing Surface"],
    "Goal Area A": ["Goal Area A"],
    "Goal Area B": ["Goal Area B"],
    "Perimeter / Sidelines": ["Perimeter / Sidelines"],
  },
}

export function getMacroZoneOptions(fieldType: FieldType): Array<{ value: MacroZone; label: string }> {
  const map = ZONE_HIERARCHY_BY_SPORT[fieldType]
  return Object.keys(map).map((macro) => ({ value: macro as MacroZone, label: macro }))
}

export function getMicroZoneOptions(fieldType: FieldType, macroZone: string): string[] {
  return ZONE_HIERARCHY_BY_SPORT[fieldType]?.[macroZone] ?? []
}
