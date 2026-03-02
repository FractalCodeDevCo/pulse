import { NextResponse } from "next/server"

import { requireAuth } from "../../../../../lib/auth/guard"
import { readProjectPlanAnalysis } from "../../../../../lib/planIntelligence/store"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response

  try {
    const { projectId } = await context.params
    const cleanProjectId = projectId?.trim()
    if (!cleanProjectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 })
    }

    const analysis = await readProjectPlanAnalysis(cleanProjectId)
    if (!analysis) return NextResponse.json({ analysis: null, found: false })

    return NextResponse.json({ analysis, found: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
