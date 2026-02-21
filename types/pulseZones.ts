export const PULSE_ZONE_OPTIONS = [
  { value: "Central", label: "Central" },
  { value: "Right Sideline", label: "Right Sideline" },
  { value: "Left Sideline", label: "Left Sideline" },
  { value: "Headers/Ends", label: "Headers/Ends" },
] as const

export type PulseZone = (typeof PULSE_ZONE_OPTIONS)[number]["value"]
