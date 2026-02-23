import { NextResponse } from "next/server"

import { computeGlueMetrics } from "../../../lib/metricsV0"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  module?: "compactacion" | "rollos" | "pegada"
  projectId?: string
  fieldType?: string
  payload?: Record<string, unknown>
}

type UnifiedCapturePayload = {
  projectId: string
  moduleType: string
  fieldType: string | null
  zone: string | null
  projectZoneId: string | null
  captureSessionId: string | null
  captureStatus: "incomplete" | "complete"
  metadata: Record<string, unknown>
  photosUrls: string[]
  createdAt: string
}

type CaptureStatus = "incomplete" | "complete"
type SummaryPayload = Record<string, unknown>

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

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeCaptureStatus(value: unknown): CaptureStatus {
  return value === "incomplete" ? "incomplete" : "complete"
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

function normalizeZoneType(value: string | null): string {
  if (!value) return "general"
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "general"
}

function validatePegadaPayload(payload: Record<string, unknown>, photosCount: number): string | null {
  const macroZone = toStringOrNull(payload.macro_zone ?? payload.macroZone)
  if (!macroZone) return "macro_zone is required for pegada."

  const microZone = toStringOrNull(payload.micro_zone ?? payload.microZone)
  if (!microZone) return "micro_zone is required for pegada."

  const condicion = toStringOrNull(payload.condicion)
  if (!condicion) return "condicion is required for pegada."

  const botesUsados = toNumber(payload.botesUsados ?? payload.botes_usados)
  if (botesUsados === null || botesUsados <= 0) return "botesUsados must be greater than 0 for pegada."

  const criticalAreas = Array.isArray(payload.critical_infield_areas)
    ? payload.critical_infield_areas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []

  const ftTotales = toNumber(payload.ftTotales ?? payload.ft_totales)
  if (criticalAreas.length === 0 && (ftTotales === null || ftTotales <= 0)) {
    return "ftTotales must be greater than 0 for pegada."
  }

  if (photosCount < 3) return "Pegada requires at least 3 photos."
  return null
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
    const allowedModules = new Set(["compactacion", "rollos", "pegada"])

    if (!body.module || !body.projectId || !body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (!allowedModules.has(body.module)) {
      return NextResponse.json({ error: "Invalid module for production records" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const projectZoneId = toStringOrNull(body.payload.project_zone_id)
    const captureSessionId = toStringOrNull(body.payload.capture_session_id)
    const captureStatus = normalizeCaptureStatus(body.payload.capture_status)

    const photoCandidates = extractPhotoCandidates(body.payload)
    if (body.module === "pegada") {
      if (!projectZoneId) {
        return NextResponse.json({ error: "project_zone_id is required for pegada." }, { status: 400 })
      }
      if (!captureSessionId) {
        return NextResponse.json({ error: "capture_session_id is required for pegada." }, { status: 400 })
      }

      const pegadaValidationError = validatePegadaPayload(body.payload, photoCandidates.length)
      if (pegadaValidationError) {
        return NextResponse.json({ error: pegadaValidationError }, { status: 400 })
      }
    }
    if (projectZoneId && !captureSessionId) {
      return NextResponse.json({ error: "capture_session_id is required when project_zone_id is provided." }, { status: 400 })
    }

    const photosUrls: string[] = []

    for (let index = 0; index < photoCandidates.length; index += 1) {
      photosUrls.push(await uploadDataUrl(supabase, photoCandidates[index], body.projectId, body.module, `${body.module}_${index}`))
    }

    const unifiedPayload: UnifiedCapturePayload = {
      projectId: body.projectId,
      moduleType: body.module,
      fieldType: body.fieldType ?? null,
      zone: (typeof body.payload.zone === "string" ? body.payload.zone : null),
      projectZoneId,
      captureSessionId,
      captureStatus,
      metadata: stripPhotoFields(body.payload),
      photosUrls,
      createdAt: new Date().toISOString(),
    }

    const macroZone =
      typeof body.payload.macro_zone === "string"
        ? body.payload.macro_zone
        : typeof unifiedPayload.metadata.macro_zone === "string"
          ? (unifiedPayload.metadata.macro_zone as string)
          : null

    const microZone =
      typeof body.payload.micro_zone === "string"
        ? body.payload.micro_zone
        : typeof unifiedPayload.metadata.micro_zone === "string"
          ? (unifiedPayload.metadata.micro_zone as string)
          : null

    log("insert_attempt", {
      module: body.module,
      projectId: body.projectId,
      photosCount: photosUrls.length,
      zone: unifiedPayload.zone,
      projectZoneId,
      captureSessionId,
      captureStatus,
    })

    const insertRow = {
      project_id: body.projectId,
      module: body.module,
      field_type: body.fieldType ?? null,
      project_zone_id: projectZoneId,
      capture_session_id: captureSessionId,
      capture_status: captureStatus,
      macro_zone: macroZone,
      micro_zone: microZone,
      payload: unifiedPayload,
    }

    let data: Record<string, unknown> | null = null
    let error: { message: string } | null = null

    const upsertResult = await supabase
      .from("field_records")
      .upsert(insertRow, { onConflict: "project_id,module,project_zone_id,capture_session_id" })
      .select("id, project_id, module, field_type, project_zone_id, capture_session_id, capture_status, payload, created_at")
      .single()
    data = upsertResult.data as Record<string, unknown> | null
    error = upsertResult.error

    if (error && hasOnConflictConstraintError(error.message)) {
      const fallback = await supabase
        .from("field_records")
        .insert(insertRow)
        .select("id, project_id, module, field_type, project_zone_id, capture_session_id, capture_status, payload, created_at")
        .single()
      data = fallback.data as Record<string, unknown> | null
      error = fallback.error
    }
    if (error && isMissingColumnError(error.message)) {
      const fallback = await supabase
        .from("field_records")
        .insert({
          project_id: body.projectId,
          module: body.module,
          field_type: body.fieldType ?? null,
          macro_zone: macroZone,
          micro_zone: microZone,
          payload: unifiedPayload,
        })
        .select("id, project_id, module, field_type, payload, created_at")
        .single()
      data = fallback.data as Record<string, unknown> | null
      error = fallback.error
    }

    if (error) {
      console.error("[capture-api] insert_failed", {
        error: error.message,
        module: body.module,
        projectId: body.projectId,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "No data returned from insert" }, { status: 500 })
    }

    let summary: SummaryPayload | null = null

    if (body.module === "pegada") {
      const linearFtEst = toNumber(body.payload.ftTotales ?? body.payload.ft_totales)
      const cansUsed = toNumber(body.payload.botesUsados ?? body.payload.botes_usados)
      const zoneTypeRaw =
        toStringOrNull(body.payload.zone_type ?? body.payload.zoneType) ??
        toStringOrNull(macroZone) ??
        toStringOrNull(unifiedPayload.zone)
      const zoneType = normalizeZoneType(zoneTypeRaw)
      const tempBucket = toStringOrNull(body.payload.temp_bucket ?? body.payload.tempBucket)
      const humidityBucket = toStringOrNull(body.payload.humidity_bucket ?? body.payload.humidityBucket)

      if (linearFtEst && linearFtEst > 0 && cansUsed !== null && cansUsed >= 0) {
        let baselineMu: number | null = null

        const baselineRead = await supabase
          .from("glue_baselines")
          .select("mu")
          .eq("zone_type", zoneType)
          .maybeSingle()

        if (baselineRead.error) {
          if (!isSchemaCompatibilityError(baselineRead.error.message)) {
            console.error("[capture-api] glue_baseline_read_failed", {
              error: baselineRead.error.message,
              zoneType,
              projectId: body.projectId,
            })
          }
        } else if (baselineRead.data?.mu !== null && baselineRead.data?.mu !== undefined) {
          baselineMu = Number(baselineRead.data.mu)
        }

        const glueMetrics = computeGlueMetrics({
          linearFtEst,
          cansUsed,
          baselineMu,
        })

        const baselineUpsert = await supabase.from("glue_baselines").upsert(
          {
            zone_type: zoneType,
            mu: glueMetrics.muAfter,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "zone_type" },
        )

        if (baselineUpsert.error && !isSchemaCompatibilityError(baselineUpsert.error.message)) {
          console.error("[capture-api] glue_baseline_upsert_failed", {
            error: baselineUpsert.error.message,
            zoneType,
            projectId: body.projectId,
          })
        }

        const glueInsertRow = {
          project_id: body.projectId,
          zone_id: projectZoneId,
          linear_ft_est: linearFtEst,
          cans_used: cansUsed,
          temp_bucket: tempBucket,
          humidity_bucket: humidityBucket,
          photos: photosUrls,
          capture_session_id: captureSessionId,
          capture_status: captureStatus,
          r: glueMetrics.r,
          mu: glueMetrics.muAfter,
          ratio_to_baseline: glueMetrics.ratioToBaseline,
          traffic_light: glueMetrics.traffic,
          predicted_cans: glueMetrics.predictedCans,
          savings_usd: glueMetrics.savingsUsd,
        }

        let glueWriteError: { message: string } | null = null
        if (captureSessionId && projectZoneId) {
          const glueUpsert = await supabase
            .from("captures_glue")
            .upsert(glueInsertRow, { onConflict: "project_id,zone_id,capture_session_id" })
            .select("id")
            .single()
          glueWriteError = glueUpsert.error

          if (glueWriteError && hasOnConflictConstraintError(glueWriteError.message)) {
            const glueFallback = await supabase
              .from("captures_glue")
              .insert(glueInsertRow)
              .select("id")
              .single()
            glueWriteError = glueFallback.error
          }
        } else {
          const glueInsert = await supabase.from("captures_glue").insert(glueInsertRow).select("id").single()
          glueWriteError = glueInsert.error
        }

        if (glueWriteError && !isSchemaCompatibilityError(glueWriteError.message)) {
          console.error("[capture-api] captures_glue_insert_failed", {
            error: glueWriteError.message,
            projectId: body.projectId,
            projectZoneId,
            captureSessionId,
          })
        }

        summary = {
          module: "pegada",
          traffic_light: glueMetrics.traffic,
          ratio_to_baseline: glueMetrics.ratioToBaseline,
          r_cans_per_ft: glueMetrics.r,
          baseline_mu: glueMetrics.muBefore,
          baseline_mu_next: glueMetrics.muAfter,
          predicted_cans: glueMetrics.predictedCans,
          savings_usd: glueMetrics.savingsUsd,
          can_price_usd: 95,
          zone_type: zoneType,
        }
      }
    }

    log("insert_success", {
      id: data.id as string | null,
      module: data.module as string | null,
      projectId: data.project_id as string | null,
    })
    return NextResponse.json({
      ...data,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    console.error("[capture-api] unexpected_error", { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
