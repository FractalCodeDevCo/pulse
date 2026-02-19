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

const DEBUG_CAPTURE = process.env.NEXT_PUBLIC_DEBUG_CAPTURE === "1"

function log(event: string, data: Record<string, unknown>) {
  if (!DEBUG_CAPTURE) return
  console.log(`[capture-client] ${event}`, data)
}

export async function saveCloudRecord(
  params: SaveCloudRecordParams,
): Promise<SaveCloudRecordResponse> {
  log("save_attempt", {
    module: params.module,
    projectId: params.projectId,
    payloadKeys: Object.keys(params.payload ?? {}),
  })

  const response = await fetch("/api/records", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  const text = await response.text()

  if (!response.ok) {
    let errorMessage = text || "Cloud save failed"
    try {
      const parsedError = JSON.parse(text) as { error?: string }
      if (parsedError?.error) errorMessage = parsedError.error
    } catch {
      // keep raw response text
    }

    console.error("[capture-client] save_failed", {
      status: response.status,
      body: text,
      module: params.module,
      projectId: params.projectId,
    })

    throw new Error(errorMessage)
  }

  const parsed = JSON.parse(text) as SaveCloudRecordResponse
  log("save_success", {
    id: parsed.id,
    module: parsed.module,
    projectId: parsed.project_id,
  })

  return parsed
}
