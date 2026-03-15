import { PlanAnalysisResult } from "./types"

const PLAN_INTELLIGENCE_PREFIX = "pulse_plan_intelligence_v1"

function getKey(projectId: string): string {
  return `${PLAN_INTELLIGENCE_PREFIX}_${projectId}`
}

export function savePlanAnalysisCache(projectId: string, analysis: PlanAnalysisResult): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(getKey(projectId), JSON.stringify(analysis))
  } catch {
    // best effort cache
  }
}

export function readPlanAnalysisCache(projectId: string): PlanAnalysisResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(getKey(projectId))
    if (!raw) return null
    return JSON.parse(raw) as PlanAnalysisResult
  } catch {
    return null
  }
}
