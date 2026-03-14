export type CaptureStatus = "incomplete" | "complete"

export function createCaptureSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeCaptureStatus(value: unknown): CaptureStatus {
  return value === "incomplete" ? "incomplete" : "complete"
}
