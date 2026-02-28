import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  projectId?: string
  fieldType?: string | null
  projectZoneId?: string
  zone?: string
  macroZone?: string
  microZone?: string
  zoneType?: string
  flowSessionId?: string
  phasesCompleted?: string[]
  phaseSessionIds?: Record<string, string>
  flowMetadata?: Record<string, unknown>
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody
    if (!body.projectId || !body.projectZoneId || !Array.isArray(body.phasesCompleted) || body.phasesCompleted.length === 0) {
      return NextResponse.json({ error: "projectId, projectZoneId, and phasesCompleted are required." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const captureSessionId = body.flowSessionId?.trim() || randomUUID()
    const metadata = {
      flow_session_id: captureSessionId,
      flow_type: "zone_flow",
      phases_completed: body.phasesCompleted,
      phase_session_ids: body.phaseSessionIds ?? {},
      zone_type: body.zoneType ?? null,
      details: body.flowMetadata ?? {},
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("field_records")
      .insert({
        project_id: body.projectId,
        module: "flow",
        field_type: body.fieldType ?? null,
        project_zone_id: body.projectZoneId,
        capture_session_id: captureSessionId,
        capture_status: "complete",
        macro_zone: body.macroZone ?? null,
        micro_zone: body.microZone ?? null,
        payload: {
          projectId: body.projectId,
          moduleType: "flow",
          fieldType: body.fieldType ?? null,
          zone: body.zone ?? null,
          projectZoneId: body.projectZoneId,
          captureSessionId,
          captureStatus: "complete",
          metadata,
          photosUrls: [],
          createdAt: new Date().toISOString(),
        },
      })
      .select("id, project_id, project_zone_id, capture_session_id, module, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      id: data.id,
      capture_session_id: data.capture_session_id,
      phases_completed: body.phasesCompleted,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
