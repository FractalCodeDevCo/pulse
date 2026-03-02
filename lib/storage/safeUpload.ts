import { getSupabaseAdminClient } from "../supabase/server"

type UploadOptions = {
  supabase: ReturnType<typeof getSupabaseAdminClient>
  dataUrlOrUrl: string
  projectId: string
  moduleName: string
  keyPath: string
  fallbackToOriginal?: boolean
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

function sanitizeExtension(mimeType: string): string {
  const raw = mimeType.split("/")[1] || "jpg"
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
  return clean || "jpg"
}

function sanitizePathSegment(value: string): string {
  const cleaned = value.trim().replace(/[^a-z0-9-_]/gi, "_")
  return cleaned || "unknown"
}

function resolveStorageBucket(): string {
  const raw = (process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence").trim()
  const safe = raw.replace(/[^a-z0-9-_]/gi, "")
  return safe || "pulse-evidence"
}

export async function uploadDataUrlToStorage(options: UploadOptions): Promise<string> {
  const { supabase, dataUrlOrUrl, projectId, moduleName, keyPath, fallbackToOriginal = true } = options
  if (!dataUrlOrUrl.startsWith("data:image/")) return dataUrlOrUrl

  const parsed = parseDataUrl(dataUrlOrUrl)
  if (!parsed) return dataUrlOrUrl

  const bucket = resolveStorageBucket()
  const extension = sanitizeExtension(parsed.mimeType)
  const safeProject = sanitizePathSegment(projectId)
  const safeModule = sanitizePathSegment(moduleName)
  const safeKey = keyPath.replace(/[^a-z0-9-_/.]/gi, "_")
  const filePath = `${safeProject}/${safeModule}/${Date.now()}-${safeKey}.${extension}`

  try {
    const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
      contentType: parsed.mimeType,
      upsert: true,
    })
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
    return data.publicUrl
  } catch (error) {
    if (!fallbackToOriginal) {
      throw new Error(error instanceof Error ? error.message : "Upload failed")
    }
    console.error("[safe-upload] upload_failed_fallback", {
      bucket,
      filePath,
      message: error instanceof Error ? error.message : "Upload failed",
    })
    return dataUrlOrUrl
  }
}
