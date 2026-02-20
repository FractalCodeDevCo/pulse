import { FieldType } from "./fieldType"

export type MacroZone =
  | "Infield"
  | "Outfield"
  | "Foul Territory"
  | "Warning Track"
  | "Borders"
  | "End Zones"
  | "Field Interior"
  | "Numbers / Logos"
  | "Goals"
  | "Sidelines"

type MacroMap = Record<string, string[]>

export const ZONE_HIERARCHY_BY_SPORT: Record<FieldType, MacroMap> = {
  beisbol: {
    Infield: [
      "Pitcher's Mound",
      "Circle interior pitch",
      "Batters Box (Left)",
      "Batters Box (Right)",
      "Home Plate area",
      "Base Path - 1st Base",
      "Base Path - 2nd Base",
      "Base Path - 3rd Base",
      "Shortstop area",
    ],
    Outfield: ["Center Field", "Left Field", "Right Field"],
    "Foul Territory": ["Foul Left", "Foul Right", "On-Deck Circles", "Dugouts"],
    "Warning Track": ["Warning Track - Left", "Warning Track - Center", "Warning Track - Right"],
    Borders: ["Perimeter Turf Strip", "Sidelines adjacentes"],
  },
  softbol: {
    Infield: [
      "Circle interior - Pitcher",
      "Batters Box (Left)",
      "Batters Box (Right)",
      "Base Path - 1st Base",
      "Base Path - 2nd Base",
      "Base Path - 3rd Base",
      "Home Plate complex",
    ],
    Outfield: ["Left Field", "Center Field", "Right Field"],
    "Foul Territory": ["Foul Left", "Foul Right"],
    "Warning Track": ["Warning Track"],
    Borders: ["Perimeter adjacent", "Sidelines"],
  },
  football: {
    "End Zones": ["Left End Zone", "Right End Zone"],
    "Field Interior": ["Hash Marks Inside", "Flank (Sideline) Left", "Flank (Sideline) Right", "Center Stripes"],
    "Numbers / Logos": ["Field Numbers", "Midfield Logo", "Yardage Markings"],
    Borders: ["Sideline buffer", "Team area / bench zones"],
  },
  soccer: {
    "Field Interior": ["Left Half", "Right Half", "Center Circle", "Penalty Box Left", "Penalty Box Right"],
    Goals: ["Goal Box Left", "Goal Box Right"],
    Sidelines: ["Touchline Left", "Touchline Right"],
    Borders: ["Endline Left", "Endline Right", "Technical Area"],
  },
}

export function getMacroZoneOptions(fieldType: FieldType): Array<{ value: MacroZone; label: string }> {
  const map = ZONE_HIERARCHY_BY_SPORT[fieldType]
  return Object.keys(map).map((macro) => ({ value: macro as MacroZone, label: macro }))
}

export function getMicroZoneOptions(fieldType: FieldType, macroZone: string): string[] {
  return ZONE_HIERARCHY_BY_SPORT[fieldType]?.[macroZone] ?? []
}
