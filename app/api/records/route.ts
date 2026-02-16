import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  module?: "compactacion" | "rollos" | "pegada" | "material"
  projectId?: string
  fieldType?: string
  payload?: Record<string, unknown>
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null

  const mimeType = match[1]
  const base64 = match[2]
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"))

  return { mimeType, bytes }
}

async function uploadDataUrl(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dataUrl: string,
  projectId: string,
  moduleName: string,
  keyPath: string,
): Promise<string> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return dataUrl

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

async function replaceDataUrls(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  value: unknown,
  projectId: string,
  moduleName: string,
  keyPath: string,
): Promise<unknown> {
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return uploadDataUrl(supabase, value, projectId, moduleName, keyPath)
  }

  if (Array.isArray(value)) {
    const nextArray: unknown[] = []
    for (let index = 0; index < value.length; index += 1) {
      const nextItem = await replaceDataUrls(
        supabase,
        value[index],
        projectId,
        moduleName,
        `${keyPath}_${index}`,
      )
      nextArray.push(nextItem)
    }

    return nextArray
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    const nextObject: Record<string, unknown> = {}

    for (const [key, nestedValue] of entries) {
      nextObject[key] = await replaceDataUrls(
        supabase,
        nestedValue,
        projectId,
        moduleName,
        `${keyPath}_${key}`,
      )
    }

    return nextObject
  }

  return value
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody

    if (!body.module || !body.projectId || !body.payload) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const processedPayload = (await replaceDataUrls(
      supabase,
      body.payload,
      body.projectId,
      body.module,
      body.module,
    )) as Record<string, unknown>

    const { data, error } = await supabase
      .from("field_records")
      .insert({
        project_id: body.projectId,
        module: body.module,
        field_type: body.fieldType ?? null,
        payload: processedPayload,
      })
      .select("id, project_id, module, field_type, payload, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
