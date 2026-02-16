import { CompactacionRecord, CompactacionRow } from "../types/compactacion"
import { RollosRecord, RollosRow } from "../types/rollos"

type ApiError = { error?: string }

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed"
    try {
      const body = (await response.json()) as ApiError
      if (body.error) message = body.error
    } catch {
      const text = await response.text()
      if (text) message = text
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function createRollosRecord(payload: RollosRecord): Promise<RollosRow> {
  const response = await fetch("/api/rollos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  return handleResponse<RollosRow>(response)
}

export async function listRollosRecords(projectId: string): Promise<RollosRow[]> {
  const response = await fetch(`/api/rollos?projectId=${encodeURIComponent(projectId)}`)
  return handleResponse<RollosRow[]>(response)
}

export async function updateRollosRecord(
  id: string,
  payload: Partial<Pick<RollosRecord, "totalRollsInstalled" | "seamsCompleted" | "wasteEstimated" | "zoneStatus" | "observations">>,
): Promise<RollosRow> {
  const response = await fetch("/api/rollos", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...payload }),
  })

  return handleResponse<RollosRow>(response)
}

export async function deleteRollosRecord(id: string): Promise<{ success: true }> {
  const response = await fetch("/api/rollos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })

  return handleResponse<{ success: true }>(response)
}

export async function createCompactacionRecord(payload: CompactacionRecord): Promise<CompactacionRow> {
  const response = await fetch("/api/compactacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  return handleResponse<CompactacionRow>(response)
}

export async function listCompactacionRecords(projectId: string): Promise<CompactacionRow[]> {
  const response = await fetch(`/api/compactacion?projectId=${encodeURIComponent(projectId)}`)
  return handleResponse<CompactacionRow[]>(response)
}

export async function updateCompactacionRecord(
  id: string,
  payload: Partial<Pick<CompactacionRecord, "trafficLightStatus" | "observations" | "compactacionType">>,
): Promise<CompactacionRow> {
  const response = await fetch("/api/compactacion", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...payload }),
  })

  return handleResponse<CompactacionRow>(response)
}

export async function deleteCompactacionRecord(id: string): Promise<{ success: true }> {
  const response = await fetch("/api/compactacion", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })

  return handleResponse<{ success: true }>(response)
}
