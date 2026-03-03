import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { buildPlanAnalysisFromLayouts, parseTurfPlanPdfBytes } from "../../../lib/planIntelligence/pdfRollParser"
import { saveProjectPlanAnalysis } from "../../../lib/planIntelligence/store"
import { ParsedPlanRollLayout, PlanFileRef } from "../../../lib/planIntelligence/types"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, "_")
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm"])
  if (!auth.ok) return auth.response
  try {
    const form = await request.formData()
    const projectId = form.get("projectId")

    if (typeof projectId !== "string" || !projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const rawFiles = form.getAll("files")
    const files = rawFiles.filter((item): item is File => item instanceof File && item.size > 0)

    if (files.length === 0) {
      return NextResponse.json({ error: "No files received" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
    const uploaded: Array<{
      name: string
      url: string
      contentType: string
      size: number
      uploadedAt: string
    }> = []
    const planFileRefs: PlanFileRef[] = []
    const parsedLayouts: ParsedPlanRollLayout[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const cleanName = sanitizeFileName(file.name || `plan_${index}`)
      const filePath = `${projectId}/setup-plans/${Date.now()}-${index}-${cleanName}`
      const bytes = Buffer.from(await file.arrayBuffer())
      const contentType = file.type || "application/octet-stream"

      const { error } = await supabase.storage.from(bucket).upload(filePath, bytes, {
        contentType,
        upsert: true,
      })
      if (error) {
        const message = error.message || "Storage upload failed"
        const isForbidden = /forbidden|unauthorized|permission|policy/i.test(message)
        return NextResponse.json(
          {
            error: isForbidden
              ? `Storage forbidden for bucket "${bucket}". Verify SUPABASE_SERVICE_ROLE_KEY and Storage policies.`
              : message,
            code: isForbidden ? "storage_forbidden" : "storage_upload_failed",
          },
          { status: isForbidden ? 403 : 500 },
        )
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      uploaded.push({
        name: file.name,
        url: data.publicUrl,
        contentType,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      })
      planFileRefs.push({
        name: file.name,
        url: data.publicUrl,
        contentType,
        size: file.size,
      })

      if (contentType.toLowerCase().includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const layout = await parseTurfPlanPdfBytes(bytes, file.name)
          parsedLayouts.push(layout)
        } catch {
          // best effort parser; upload should still succeed
        }
      }
    }

    let analysis = null
    if (parsedLayouts.length > 0) {
      analysis = buildPlanAnalysisFromLayouts(projectId, planFileRefs, parsedLayouts)
      await saveProjectPlanAnalysis(projectId, analysis)
    }

    return NextResponse.json({ files: uploaded, analysis })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
