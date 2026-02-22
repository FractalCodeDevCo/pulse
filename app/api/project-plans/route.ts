import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, "_")
}

export async function POST(request: Request) {
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
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      uploaded.push({
        name: file.name,
        url: data.publicUrl,
        contentType,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ files: uploaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
