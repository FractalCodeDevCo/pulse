const ZONE_PHOTO_CACHE_PREFIX = "pulse_zone_photos_v1"

function buildKey(projectId: string, projectZoneId: string): string {
  return `${ZONE_PHOTO_CACHE_PREFIX}:${projectId}:${projectZoneId}`
}

function canUseStorage(): boolean {
  return typeof window !== "undefined"
}

export function saveZonePhotosCache(projectId: string, projectZoneId: string, photos: string[]): void {
  if (!canUseStorage()) return
  try {
    const key = buildKey(projectId, projectZoneId)
    const payload = JSON.stringify(photos.slice(0, 3))
    sessionStorage.setItem(key, payload)
  } catch {
    // ignore cache failures
  }
}

export function readZonePhotosCache(projectId: string, projectZoneId: string): string[] {
  if (!canUseStorage()) return []
  try {
    const key = buildKey(projectId, projectZoneId)
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 3)
  } catch {
    return []
  }
}
