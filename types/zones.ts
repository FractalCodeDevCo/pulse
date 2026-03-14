export enum Zone {
  CENTRAL = "CENTRAL",
  SIDELINE_RIGHT = "SIDELINE_RIGHT",
  SIDELINE_LEFT = "SIDELINE_LEFT",
  CABECERAS = "CABECERAS",
}

export const ZONE_OPTIONS: Array<{ value: Zone; label: string }> = [
  { value: Zone.CENTRAL, label: "Central" },
  { value: Zone.SIDELINE_RIGHT, label: "Sideline Derecho" },
  { value: Zone.SIDELINE_LEFT, label: "Sideline Izquierdo" },
  { value: Zone.CABECERAS, label: "Cabeceras" },
]
