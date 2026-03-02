import { PlanAnalysisResult } from "./types"
import { getSupabaseAdminClient } from "../supabase/server"

function isMissingRelationOrColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return (lower.includes("relation") || lower.includes("column")) && lower.includes("does not exist")
}

export async function saveProjectPlanAnalysis(projectId: string, analysis: PlanAnalysisResult): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const upsert = await supabase.from("project_plan_intelligence").upsert(
    {
      project_id: projectId,
      analysis,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  )

  if (upsert.error && !isMissingRelationOrColumnError(upsert.error.message)) {
    throw new Error(upsert.error.message)
  }
}

export async function readProjectPlanAnalysis(projectId: string): Promise<PlanAnalysisResult | null> {
  const supabase = getSupabaseAdminClient()
  const res = await supabase
    .from("project_plan_intelligence")
    .select("analysis")
    .eq("project_id", projectId)
    .maybeSingle()

  if (res.error) {
    if (isMissingRelationOrColumnError(res.error.message)) return null
    throw new Error(res.error.message)
  }

  const analysis = (res.data?.analysis ?? null) as PlanAnalysisResult | null
  return analysis
}
