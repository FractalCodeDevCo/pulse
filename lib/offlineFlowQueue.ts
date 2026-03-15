export type FlowSessionPayload = Record<string, unknown>

export type OfflineFlowQueueItem = {
  id: string
  projectId: string
  projectZoneId: string
  payload: FlowSessionPayload
  createdAt: string
  attempts: number
  lastError: string | null
}

const STORAGE_KEY = "pulse_flow_queue_v1"

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

export function readOfflineFlowQueue(): OfflineFlowQueueItem[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is OfflineFlowQueueItem => {
      if (!item || typeof item !== "object") return false
      const row = item as Record<string, unknown>
      return (
        typeof row.id === "string" &&
        typeof row.projectId === "string" &&
        typeof row.projectZoneId === "string" &&
        row.payload !== null &&
        typeof row.payload === "object"
      )
    })
  } catch {
    return []
  }
}

function writeOfflineFlowQueue(items: OfflineFlowQueueItem[]): void {
  if (!canUseStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function enqueueOfflineFlow(payload: FlowSessionPayload, projectId: string, projectZoneId: string): OfflineFlowQueueItem {
  const item: OfflineFlowQueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    projectId,
    projectZoneId,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }
  const current = readOfflineFlowQueue()
  current.push(item)
  writeOfflineFlowQueue(current)
  return item
}

export function replaceOfflineFlowQueue(items: OfflineFlowQueueItem[]): void {
  writeOfflineFlowQueue(items)
}

export function countOfflineFlowForZone(projectId: string, projectZoneId: string): number {
  return readOfflineFlowQueue().filter((item) => item.projectId === projectId && item.projectZoneId === projectZoneId).length
}
