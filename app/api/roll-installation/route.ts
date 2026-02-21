import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type PhotoType = "compacting" | "in_progress" | "completed"
type IncomingPhotos = Record<PhotoType, string | undefined>

type RequestBody = {
  zone?: string
  roll_length_fit?: string
  total_rolls_used?: number
  total_seams?: number
  compaction_surface_firm?: boolean
  compaction_moisture_ok?: boolean
  compaction_double?: boolean
  compaction_method?: string
  photos?: IncomingPhotos
}

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody

    const requiredPhotoTypes: PhotoType[] = ["compacting", "in_progress", "completed"]
    if (
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

    for (const type of requiredPhotoTypes) {
      if (!body.photos[type]) {
        return NextResponse.json({ error: `Missing required photo: ${type}` }, { status: 400 })
      }
    }

    const id = randomUUID()
    const uploadedPhotos: Array<{ type: PhotoType; url: string }> = []
    for (const type of requiredPhotoTypes) {
      const url = await uploadPhoto(id, type, body.photos[type] as string)
      uploadedPhotos.push({ type, url })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("roll_installation")
      .insert({
        id,
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
