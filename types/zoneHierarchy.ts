import { FieldType } from "./fieldType"

export type MacroZone = "CENTRAL" | "LATERAL" | "PERIMETRAL" | "CRITICA" | "TRANSICION"

export const MACRO_ZONE_OPTIONS: Array<{ value: MacroZone; label: string }> = [
  { value: "CENTRAL", label: "Central" },
  { value: "LATERAL", label: "Lateral" },
  { value: "PERIMETRAL", label: "Perimetral" },
  { value: "CRITICA", label: "Crítica" },
  { value: "TRANSICION", label: "Transición" },
]

const MICRO_ZONES_BY_FIELD_AND_MACRO: Record<FieldType, Record<MacroZone, string[]>> = {
  football: {
    CENTRAL: ["Central field", "Logo"],
    LATERAL: ["Hash left", "Hash right", "Sidelines"],
    PERIMETRAL: ["Sidelines"],
    CRITICA: ["Red zone", "End zone"],
    TRANSICION: ["Hash left", "Hash right"],
  },
  soccer: {
    CENTRAL: ["Central strip", "Logo"],
    LATERAL: ["Left wing", "Right wing", "Sidelines"],
    PERIMETRAL: ["Corners", "Sidelines"],
    CRITICA: ["Goal box left", "Goal box right", "Penalty area"],
    TRANSICION: ["Left wing", "Right wing"],
  },
  beisbol: {
    CENTRAL: ["Infield", "Outfield", "Logo area"],
    LATERAL: ["Foul territory", "Sideline (gradas)"],
    PERIMETRAL: ["Warning track", "Foul territory"],
    CRITICA: ["Batter box", "Pitcher mound"],
    TRANSICION: ["Outfield", "Warning track"],
  },
  softbol: {
    CENTRAL: ["Infield", "Outfield", "Logo area"],
    LATERAL: ["Foul territory", "Sideline (gradas)"],
    PERIMETRAL: ["Warning track", "Foul territory"],
    CRITICA: ["Batter box", "Pitcher mound"],
    TRANSICION: ["Outfield", "Warning track"],
  },
}

export function getMicroZoneOptions(fieldType: FieldType, macroZone: MacroZone): string[] {
  return MICRO_ZONES_BY_FIELD_AND_MACRO[fieldType]?.[macroZone] ?? []
}
