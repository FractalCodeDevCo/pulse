type SaveCloudRecordParams = {
  module: "compactacion" | "rollos" | "pegada" | "material"
  projectId: string
  fieldType?: string
  payload: Record<string, unknown>
}

type SaveCloudRecordResponse = {
  id: string
  project_id: string
  module: string
  field_type: string | null
  payload: Record<string, unknown>
  created_at: string
}

export async function saveCloudRecord(
  params: SaveCloudRecordParams,
): Promise<SaveCloudRecordResponse> {
  const response = await fetch("/api/records", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || "Cloud save failed")
  }

  return (await response.json()) as SaveCloudRecordResponse
}
