import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  module?: "compactacion" | "rollos" | "pegada" | "material"
  projectId?: string
  fieldType?: string
  payload?: Record<string, unknown>
}

type UnifiedCapturePayload = {
  projectId: string
  moduleType: string
  fieldType: string | null
  zone: string | null
  metadata: Record<string, unknown>
  photosUrls: string[]
  createdAt: string
}

const DEBUG_CAPTURE = process.env.NEXT_PUBLIC_DEBUG_CAPTURE === "1" || process.env.DEBUG_CAPTURE === "1"

function log(event: string, data: Record<string, unknown>) {
  if (!DEBUG_CAPTURE) return
  console.log(`[capture-api] ${event}`, data)
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null

  const mimeType = match[1]
  const base64 = match[2]
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"))

  return { mimeType, bytes }
}

function isImageLike(value: unknown): value is string {
  return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("http"))
}

function extractPhotoCandidates(payload: Record<string, unknown>): string[] {
  const photos: string[] = []

  const directKeys = ["photos", "fotos"]
  for (const key of directKeys) {
    const value = payload[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isImageLike(item)) photos.push(item)
      }
    }
  }

  const evidencePhotos = payload.evidencePhotos
  if (evidencePhotos && typeof evidencePhotos === "object") {
    for (const value of Object.values(evidencePhotos as Record<string, unknown>)) {
      if (isImageLike(value)) photos.push(value)
    }
  }

  for (const key of ["labelPhoto", "installationPhoto", "evidencePhoto"]) {
    const value = payload[key]
    if (isImageLike(value)) photos.push(value)
  }

  return photos
}

function stripPhotoFields(payload: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["photos", "fotos", "evidencePhotos", "labelPhoto", "installationPhoto", "evidencePhoto"]) 
  const metadata: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key)) continue
    if (key === "timestamp" || key === "createdAt") continue
    metadata[key] = value
  }

  return metadata
}

async function uploadDataUrl(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dataUrlOrUrl: string,
  projectId: string,
  moduleName: string,
  keyPath: string,
): Promise<string> {
  if (!dataUrlOrUrl.startsWith("data:image/")) return dataUrlOrUrl

  const parsed = parseDataUrl(dataUrlOrUrl)
  if (!parsed) return dataUrlOrUrl

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const extension = parsed.mimeType.split("/")[1] || "jpg"
  const safeKeyPath = keyPath.replace(/[^a-z0-9-_/.]/gi, "_")
  const filePath = `${projectId}/${moduleName}/${Date.now()}-${safeKeyPath}.${extension}`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody

    if (!body.module || !body.projectId || !body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    const photoCandidates = extractPhotoCandidates(body.payload)
    const photosUrls: string[] = []

    for (let index = 0; index < photoCandidates.length; index += 1) {
      photosUrls.push(await uploadDataUrl(supabase, photoCandidates[index], body.projectId, body.module, `${body.module}_${index}`))
    }

    const unifiedPayload: UnifiedCapturePayload = {
      projectId: body.projectId,
      moduleType: body.module,
      fieldType: body.fieldType ?? null,
      zone: (typeof body.payload.zone === "string" ? body.payload.zone : null),
      metadata: stripPhotoFields(body.payload),
      photosUrls,
      createdAt: new Date().toISOString(),
    }

    log("insert_attempt", {
      module: body.module,
      projectId: body.projectId,
      photosCount: photosUrls.length,
      zone: unifiedPayload.zone,
    })

    const { data, error } = await supabase
      .from("field_records")
      .insert({
        project_id: body.projectId,
        module: body.module,
        field_type: body.fieldType ?? null,
        payload: unifiedPayload,
      })
      .select("id, project_id, module, field_type, payload, created_at")
      .single()

    if (error) {
      console.error("[capture-api] insert_failed", {
        error: error.message,
        module: body.module,
        projectId: body.projectId,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    log("insert_success", { id: data.id, module: data.module, projectId: data.project_id })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    console.error("[capture-api] unexpected_error", { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
