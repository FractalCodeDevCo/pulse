import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  zone?: string
  length_ft?: number | null
  color_letter?: string | null
  status?: "Verified" | "Mismatch"
  notes?: string | null
  label_photo?: string
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

async function uploadLabelPhoto(recordId: string, source: string): Promise<string> {
  if (!source.startsWith("data:image/")) return source
  const parsed = parseDataUrl(source)
  if (!parsed) return source

  const supabase = getSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const filePath = `roll-verification/${recordId}/label.jpg`

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
    if (!body.zone || !body.status || !body.label_photo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const id = randomUUID()
    const photoUrl = await uploadLabelPhoto(id, body.label_photo)

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("roll_verification")
      .insert({
        id,
        zone: body.zone,
        length_ft: typeof body.length_ft === "number" ? body.length_ft : null,
        color_letter: body.color_letter?.trim() || null,
        status: body.status,
        notes: body.notes?.trim() || null,
        photo_url: photoUrl,
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
