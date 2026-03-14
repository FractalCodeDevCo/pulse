import { PlanAnalysisResult, PlanFileRef } from "./types"

type AnalyzeResponse = {
  analysis: PlanAnalysisResult
  message: string
}

export async function analyzePlanScaffold(projectId: string, files: PlanFileRef[]): Promise<PlanAnalysisResult> {
  const response = await fetch("/api/plan-intelligence/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      files,
    }),
  })

  const data = (await response.json()) as AnalyzeResponse & { error?: string }
  if (!response.ok) throw new Error(data.error ?? "Plan analysis failed")

  return data.analysis
}
