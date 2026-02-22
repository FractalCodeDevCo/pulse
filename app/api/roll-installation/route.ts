import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type PhotoType = "compacting" | "in_progress" | "completed"
type IncomingPhotos = Record<PhotoType, string | undefined>

type RequestBody = {
  project_id?: string | null
  project_zone_id?: string | null
  field_type?: string | null
  macro_zone?: string | null
  micro_zone?: string | null
  zone_type?: string | null
  zone?: string
  roll_length_fit?: string
  total_rolls_used?: number
  total_seams?: number
  compaction_surface_firm?: boolean
  compaction_moisture_ok?: boolean
  compaction_double?: boolean
  compaction_method?: string
  capture_session_id?: string | null
  capture_status?: "incomplete" | "complete" | null
  photos?: IncomingPhotos
}

type CaptureStatus = "incomplete" | "complete"

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

async function uploadPhoto(projectRecordId: string, type: PhotoType, source: string): Promise<string> {
  if (!source.startsWith("data:image/")) return source
  const parsed = parseDataUrl(source)
  if (!parsed) return source

  const supabase = getSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const filePath = `roll-installation/${projectRecordId}/${type}.jpg`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}

function normalizeCaptureStatus(value: unknown): CaptureStatus {
  return value === "incomplete" ? "incomplete" : "complete"
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody

    const requiredPhotoTypes: PhotoType[] = ["compacting", "in_progress", "completed"]
    if (
      !body.project_id ||
      !body.project_zone_id ||
      !body.capture_session_id ||
      !body.zone ||
      !body.roll_length_fit ||
      typeof body.total_rolls_used !== "number" ||
      typeof body.total_seams !== "number" ||
      typeof body.compaction_surface_firm !== "boolean" ||
      typeof body.compaction_moisture_ok !== "boolean" ||
      typeof body.compaction_double !== "boolean" ||
      !body.compaction_method ||
      !body.photos
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (body.total_rolls_used < 0 || !Number.isInteger(body.total_rolls_used)) {
      return NextResponse.json({ error: "total_rolls_used must be an integer >= 0" }, { status: 400 })
    }
    if (body.total_seams < 0 || !Number.isInteger(body.total_seams)) {
      return NextResponse.json({ error: "total_seams must be an integer >= 0" }, { status: 400 })
    }

    for (const type of requiredPhotoTypes) {
      if (!body.photos[type]) {
        return NextResponse.json({ error: `Missing required photo: ${type}` }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdminClient()
    const existingRecord = await supabase
      .from("roll_installation")
      .select("*")
      .eq("project_id", body.project_id)
      .eq("project_zone_id", body.project_zone_id)
      .eq("capture_session_id", body.capture_session_id)
      .maybeSingle()

    if (!existingRecord.error && existingRecord.data) {
      return NextResponse.json(existingRecord.data)
    }
    if (existingRecord.error && !isMissingColumnError(existingRecord.error.message)) {
      return NextResponse.json({ error: existingRecord.error.message }, { status: 500 })
    }

    const id = randomUUID()
    const uploadedPhotos: Array<{ type: PhotoType; url: string }> = []
    for (const type of requiredPhotoTypes) {
      const url = await uploadPhoto(id, type, body.photos[type] as string)
      uploadedPhotos.push({ type, url })
    }

    const captureStatus = normalizeCaptureStatus(body.capture_status)
    const row = {
      id,
      project_id: body.project_id,
      project_zone_id: body.project_zone_id,
      field_type: body.field_type ?? null,
      macro_zone: body.macro_zone ?? null,
      micro_zone: body.micro_zone ?? null,
      zone_type: body.zone_type ?? null,
      zone: body.zone,
      roll_length_fit: body.roll_length_fit,
      total_rolls_used: body.total_rolls_used,
      total_seams: body.total_seams,
      compaction_surface_firm: body.compaction_surface_firm,
      compaction_moisture_ok: body.compaction_moisture_ok,
      compaction_double: body.compaction_double,
      compaction_method: body.compaction_method,
      capture_session_id: body.capture_session_id,
      capture_status: captureStatus,
      photos: uploadedPhotos,
    }

    let { data, error } = await supabase
      .from("roll_installation")
      .insert(row)
      .select("*")
      .single()

    if (error && isMissingColumnError(error.message)) {
      const fallback = await supabase
        .from("roll_installation")
        .insert({
          id,
          project_id: body.project_id,
          project_zone_id: body.project_zone_id,
          field_type: body.field_type ?? null,
          macro_zone: body.macro_zone ?? null,
          micro_zone: body.micro_zone ?? null,
          zone_type: body.zone_type ?? null,
          zone: body.zone,
          roll_length_fit: body.roll_length_fit,
          total_rolls_used: body.total_rolls_used,
          total_seams: body.total_seams,
          compaction_surface_firm: body.compaction_surface_firm,
          compaction_moisture_ok: body.compaction_moisture_ok,
          compaction_double: body.compaction_double,
          compaction_method: body.compaction_method,
          photos: uploadedPhotos,
        })
        .select("*")
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
