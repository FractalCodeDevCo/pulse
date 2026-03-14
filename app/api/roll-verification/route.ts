import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { writeUnifiedCaptures } from "../../../lib/captures/writeUnifiedCaptures"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  project_id?: string | null
  project_zone_id?: string | null
  field_type?: string | null
  macro_zone?: string | null
  micro_zone?: string | null
  zone_type?: string | null
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

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

function hasOnConflictConstraintError(message: string): boolean {
  return message.toLowerCase().includes("there is no unique or exclusion constraint matching the on conflict specification")
}

function isSchemaCompatibilityError(message: string): boolean {
  return isMissingColumnError(message) || isMissingRelationError(message) || hasOnConflictConstraintError(message)
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as RequestBody
    if (!body.project_id || !body.zone || !body.status || !body.label_photo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const id = randomUUID()
    const photoUrl = await uploadLabelPhoto(id, body.label_photo)

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("roll_verification")
      .insert({
        id,
        project_id: body.project_id ?? null,
        project_zone_id: body.project_zone_id ?? null,
        field_type: body.field_type ?? null,
        macro_zone: body.macro_zone ?? null,
        micro_zone: body.micro_zone ?? null,
        zone_type: body.zone_type ?? null,
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

    try {
      await writeUnifiedCaptures({
        supabase,
        captures: [
          {
            projectId: body.project_id,
            phase: "verify",
            imageUrl: photoUrl,
            crew: auth.context.email,
            zone: body.zone ?? body.micro_zone ?? body.macro_zone ?? null,
            notes: body.notes?.trim() || null,
            metadata: {
              projectZoneId: body.project_zone_id ?? null,
              fieldType: body.field_type ?? null,
              macroZone: body.macro_zone ?? null,
              microZone: body.micro_zone ?? null,
              zoneType: body.zone_type ?? null,
              lengthFt: typeof body.length_ft === "number" ? body.length_ft : null,
              colorLetter: body.color_letter?.trim() || null,
              verificationStatus: body.status === "Mismatch" ? "mismatch" : "ok",
            },
          },
        ],
      })
    } catch (captureError) {
      console.error("[roll-verification-api] unified_captures_insert_failed", {
        error: captureError instanceof Error ? captureError.message : "unknown",
        projectId: body.project_id ?? null,
        projectZoneId: body.project_zone_id ?? null,
      })
    }

    const summary = {
      module: "roll-verification",
      verification_status: body.status,
      length_ft: typeof body.length_ft === "number" ? body.length_ft : null,
      color_letter: body.color_letter?.trim() || null,
    }

    return NextResponse.json({
      ...data,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
