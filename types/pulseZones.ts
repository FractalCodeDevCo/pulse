export const PULSE_ZONE_OPTIONS = [
  { value: "Infield", label: "Infield" },
  { value: "Outfield", label: "Outfield" },
  { value: "Sidelines", label: "Sidelines" },
  { value: "Central", label: "Central" },
  { value: "Endzones", label: "Endzones" },
  { value: "Areas de Portero", label: "Areas de Portero" },
  { value: "Midfield", label: "Midfield" },
] as const

export type PulseZone = (typeof PULSE_ZONE_OPTIONS)[number]["value"]
