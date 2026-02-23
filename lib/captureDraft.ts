"use client"

export function readCaptureDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveCaptureDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota/serialization failures. Draft persistence is best effort.
  }
}

export function clearCaptureDraft(key: string): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
