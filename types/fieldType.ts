export type FieldType = "football" | "soccer" | "beisbol" | "softbol"

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  football: "Football",
  soccer: "Soccer",
  beisbol: "Beisbol",
  softbol: "Softbol",
}

export function getProjectFieldTypeStorageKey(projectId: string): string {
  return `pulse_project_field_type_${projectId}`
}

export function readProjectFieldType(projectId: string): FieldType {
  if (typeof window === "undefined") return "football"

  try {
    const raw = localStorage.getItem(getProjectFieldTypeStorageKey(projectId))
    if (!raw) return "football"
    const parsed = JSON.parse(raw) as FieldType
    if (parsed in FIELD_TYPE_LABELS) return parsed
  } catch {
    // fallback
  }

  return "football"
}

export function saveProjectFieldType(projectId: string, fieldType: FieldType): void {
  localStorage.setItem(getProjectFieldTypeStorageKey(projectId), JSON.stringify(fieldType))
}
