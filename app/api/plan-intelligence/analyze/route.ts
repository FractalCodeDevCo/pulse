import { NextResponse } from "next/server"

import { requireAuth } from "../../../../lib/auth/guard"
import { buildPlanAnalysisScaffold, enrichPlanAnalysisFromPdfs } from "../../../../lib/planIntelligence/scaffold"
import { PlanFileRef } from "../../../../lib/planIntelligence/types"

export const runtime = "nodejs"

type AnalyzeRequest = {
  projectId?: string
  files?: PlanFileRef[]
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as AnalyzeRequest
    const projectId = body.projectId?.trim()
    const files = body.files ?? []

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "files are required" }, { status: 400 })
    }

    const sanitizedFiles = files.filter((file) => Boolean(file?.name?.trim()))
    if (sanitizedFiles.length === 0) {
      return NextResponse.json({ error: "files[].name is required" }, { status: 400 })
    }

    const scaffold = buildPlanAnalysisScaffold(projectId, sanitizedFiles)
    const analysis = await enrichPlanAnalysisFromPdfs(scaffold, sanitizedFiles)

    return NextResponse.json({
      analysis,
      message: "Plan Intelligence scaffold completed (v0).",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
