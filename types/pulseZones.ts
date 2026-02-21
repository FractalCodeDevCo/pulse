export const PULSE_ZONE_OPTIONS = [
  { value: "Infield", label: "Infield" },
  { value: "Outfield", label: "Outfield" },
  { value: "Sidelines/Foul/Warning Track", label: "Sidelines/Foul/Warning Track" },
  { value: "Central", label: "Central" },
  { value: "Endzones", label: "Endzones" },
  { value: "Sidelines", label: "Sidelines" },
  { value: "Area Izq", label: "Area Izq" },
  { value: "Area Der", label: "Area Der" },
] as const

export type PulseZone = (typeof PULSE_ZONE_OPTIONS)[number]["value"]
