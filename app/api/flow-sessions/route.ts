import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { recordCaptureEvent, recordMetadataVersion } from "../../../lib/audit/captureAudit"
import { uploadDataUrlToStorage } from "../../../lib/storage/safeUpload"
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
  photos?: string[]
}

async function uploadDataUrl(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dataUrlOrUrl: string,
  projectId: string,
  keyPath: string,
): Promise<string> {
  return uploadDataUrlToStorage({
    supabase,
    dataUrlOrUrl,
    projectId,
    moduleName: "flow",
    keyPath,
    fallbackToOriginal: true,
  })
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as RequestBody
    if (!body.projectId || !body.projectZoneId || !Array.isArray(body.phasesCompleted) || body.phasesCompleted.length === 0) {
      return NextResponse.json({ error: "projectId, projectZoneId, and phasesCompleted are required." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const captureSessionId = body.flowSessionId?.trim() || randomUUID()
    const sourcePhotos = Array.isArray(body.photos)
      ? body.photos.filter((photo): photo is string => typeof photo === "string" && photo.length > 0).slice(0, 8)
      : []
    const photosUrls: string[] = []
    for (let index = 0; index < sourcePhotos.length; index += 1) {
      photosUrls.push(await uploadDataUrl(supabase, sourcePhotos[index], body.projectId, `${captureSessionId}_${index}`))
    }

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
          photosUrls,
          createdAt: new Date().toISOString(),
        },
      })
      .select("id, project_id, project_zone_id, capture_session_id, module, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recordMetadataVersion({
      projectId: body.projectId,
      sourceTable: "field_records",
      captureId: data.id,
      module: "flow",
      metadata,
      editedBy: auth.context.userId,
      editorEmail: auth.context.email,
    })
    await recordCaptureEvent({
      projectId: body.projectId,
      sourceTable: "field_records",
      captureId: data.id,
      module: "flow",
      action: "create",
      actorUserId: auth.context.userId,
      actorEmail: auth.context.email,
      afterData: {
        metadata,
        photosUrls,
      },
    })

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
