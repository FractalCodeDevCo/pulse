export type ZoneType =
  | "pitcher_mound"
  | "bat_box"
  | "sideline"
  | "arc_brown_green";

export const STANDARDS: Record<ZoneType, number> = {
  pitcher_mound: 1,
  bat_box: 2,
  sideline: 5,
  arc_brown_green: 3.5,
};

export type StatusType = "green" | "yellow" | "red";

export function getStatus(zone: ZoneType, usedBotes: number): StatusType {
  const expected = STANDARDS[zone];

  if (!expected) return "green";

  const deviation = (usedBotes - expected) / expected;

  if (deviation <= 0.10) return "green";
  if (deviation <= 0.20) return "yellow";
  return "red";
}
