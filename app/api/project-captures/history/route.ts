import { NextResponse } from "next/server"

import { requireAuth } from "../../../../lib/auth/guard"
import { getSupabaseAdminClient } from "../../../../lib/supabase/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("project")?.trim()
    const captureId = searchParams.get("captureId")?.trim()
    const sourceTable = searchParams.get("sourceTable")?.trim() || "field_records"

    if (!projectId || !captureId) {
      return NextResponse.json({ error: "project and captureId are required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const [eventsRes, versionsRes] = await Promise.all([
      supabase
        .from("capture_change_log")
        .select("id, created_at, action, actor_user_id, actor_email, before_data, after_data")
        .eq("project_id", projectId)
        .eq("source_table", sourceTable)
        .eq("capture_id", captureId)
        .order("created_at", { ascending: false }),
      supabase
        .from("capture_metadata_versions")
        .select("id, created_at, version, module, edited_by, editor_email, metadata")
        .eq("project_id", projectId)
        .eq("source_table", sourceTable)
        .eq("capture_id", captureId)
        .order("version", { ascending: false }),
    ])

    if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 })
    if (versionsRes.error) return NextResponse.json({ error: versionsRes.error.message }, { status: 500 })

    return NextResponse.json({
      events: eventsRes.data ?? [],
      metadataVersions: versionsRes.data ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
