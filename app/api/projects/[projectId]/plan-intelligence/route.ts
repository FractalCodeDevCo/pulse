import { NextResponse } from "next/server"

import { requireAuth } from "../../../../../lib/auth/guard"
import { readProjectPlanAnalysis, saveProjectPlanAnalysis } from "../../../../../lib/planIntelligence/store"

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

type PatchBody = {
  planKey?: string
  page?: number
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response

  try {
    const { projectId } = await context.params
    const cleanProjectId = projectId?.trim()
    if (!cleanProjectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 })
    }

    const body = (await request.json()) as PatchBody
    const planKey = body.planKey?.trim()
    const page = typeof body.page === "number" ? body.page : Number.NaN
    if (!planKey || !Number.isFinite(page) || page < 1) {
      return NextResponse.json({ error: "planKey and page are required." }, { status: 400 })
    }

    const analysis = await readProjectPlanAnalysis(cleanProjectId)
    if (!analysis) {
      return NextResponse.json({ error: "Plan analysis not found for this project." }, { status: 404 })
    }

    const nextAnalysis = {
      ...analysis,
      manualRollLayoutPages: {
        ...(analysis.manualRollLayoutPages ?? {}),
        [planKey]: Math.floor(page),
      },
      notes: [...analysis.notes, `Manual roll-layout page set for ${planKey}: ${Math.floor(page)}`].slice(-50),
    }

    await saveProjectPlanAnalysis(cleanProjectId, nextAnalysis)
    return NextResponse.json({ ok: true, analysis: nextAnalysis })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
