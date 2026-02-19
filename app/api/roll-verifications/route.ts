import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RollVerificationRequestBody = {
  project_id?: string
  field_type?: string
  macro_zone?: string
  micro_zone?: string
  roll_color?: string
  roll_feet_total?: number
  roll_lot_id?: string
  label_photo?: string
  status?: "pending" | "confirmed" | "rejected"
  rejection_reason?: string
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

async function uploadLabelPhoto(
  dataUrlOrUrl: string,
  projectId: string,
): Promise<string> {
  if (!dataUrlOrUrl.startsWith("data:image/")) return dataUrlOrUrl

  const parsed = parseDataUrl(dataUrlOrUrl)
  if (!parsed) return dataUrlOrUrl

  const supabase = getSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const extension = parsed.mimeType.split("/")[1] || "jpg"
  const filePath = `${projectId}/roll-verifications/${Date.now()}-label.${extension}`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RollVerificationRequestBody

    if (
      !body.project_id ||
      !body.field_type ||
      !body.macro_zone ||
      !body.micro_zone ||
      !body.roll_color ||
      typeof body.roll_feet_total !== "number" ||
      body.roll_feet_total <= 0 ||
      !body.label_photo ||
      !body.status
    ) {
      return NextResponse.json({ error: "Missing required verification fields" }, { status: 400 })
    }

    if (body.status === "rejected" && !body.rejection_reason?.trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    const labelPhotoUrl = await uploadLabelPhoto(body.label_photo, body.project_id)
    const payload = {
      project_id: body.project_id,
      module: "roll_verification",
      macro_zone: body.macro_zone,
      micro_zone: body.micro_zone,
      roll_color: body.roll_color,
      roll_feet_total: body.roll_feet_total,
      roll_lot_id: body.roll_lot_id ?? "",
      label_photo: labelPhotoUrl,
      status: body.status,
      rejection_reason: body.rejection_reason ?? "",
      timestamp: new Date().toISOString(),
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("roll_verifications")
      .insert({
        project_id: body.project_id,
        field_type: body.field_type,
        macro_zone: body.macro_zone,
        micro_zone: body.micro_zone,
        roll_color: body.roll_color,
        roll_feet_total: body.roll_feet_total,
        roll_lot_id: body.roll_lot_id ?? null,
        label_photo_url: labelPhotoUrl,
        status: body.status,
        rejection_reason: body.status === "rejected" ? body.rejection_reason?.trim() ?? null : null,
        payload,
      })
      .select("id, project_id, macro_zone, micro_zone, status, created_at")
      .single()

    if (error) {
      console.error("[roll-verifications-api] insert_failed", { error: error.message, projectId: body.project_id })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    console.error("[roll-verifications-api] unexpected_error", { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
