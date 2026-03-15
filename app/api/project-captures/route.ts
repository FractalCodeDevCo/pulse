import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { extractFieldRecordMetadata, recordCaptureEvent, recordMetadataVersion } from "../../../lib/audit/captureAudit"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type CaptureItem = {
  id: string
  module: string
  createdAt: string
  macroZone: string | null
  microZone: string | null
  projectZoneId: string | null
  photos: string[]
  photoCaptureIds: string[]
  photoQualityLabels: Array<"green" | "yellow" | "red" | null>
  summary: string
  metadata: Record<string, unknown>
  sourceTable: string
  editable: boolean
  labelEditable: boolean
  qualityLabel: "green" | "yellow" | "red" | null
}

type UnifiedCaptureRow = {
  id: string
  phase: string | null
  project_zone_id: string | null
  capture_session_id: string | null
  source_id: string | null
  photo_type: string | null
  macro_zone: string | null
  micro_zone: string | null
  zone: string | null
  image_url: string | null
  notes: string | null
  timestamp: string | null
  feet_installed: number | null
  rolls_used: number | null
  glue_buckets: number | null
  seams: number | null
  roll_length_fit: string | null
  quality_label: string | null
  metadata: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toStringSafe(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function isMissingRelationError(error: unknown): boolean {
  if (!isObject(error)) return false
  return error.code === "42P01"
}

function resolveCaptureTable(module: string): { table: string; isFieldRecord: boolean } | null {
  if (module === "flow" || module === "pegada" || module === "rollos" || module === "compactacion" || module === "field_record") {
    return { table: "field_records", isFieldRecord: true }
  }
  if (module === "roll_installation") return { table: "roll_installation", isFieldRecord: false }
  if (module === "material") return { table: "material_records", isFieldRecord: false }
  if (module === "incidence") return { table: "incidences", isFieldRecord: false }
  if (module === "roll_verification") return { table: "roll_verification", isFieldRecord: false }
  if (module === "roll_verifications") return { table: "roll_verifications", isFieldRecord: false }
  return null
}

function toNumberSafe(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatCaptureSummary(row: UnifiedCaptureRow, metadata: Record<string, unknown>): string {
  const phase = row.phase ?? "capture"
  const quality = typeof row.quality_label === "string" ? row.quality_label.toUpperCase() : null

  if (phase === "glue") {
    const ft = row.feet_installed ?? toNumberSafe(metadata.ftTotales) ?? toNumberSafe(metadata.ft_totales)
    const botes = row.glue_buckets ?? toNumberSafe(metadata.botesUsados) ?? toNumberSafe(metadata.botes_usados)
    const base = `Ft: ${ft ?? "-"} · Botes: ${botes ?? "-"}`
    return quality ? `${base} · ${quality}` : base
  }

  if (phase === "roll_install") {
    const rolls = row.rolls_used ?? toNumberSafe(metadata.totalRollsUsed) ?? toNumberSafe(metadata.totalRolls)
    const seams = row.seams ?? toNumberSafe(metadata.totalSeams)
    const fit = row.roll_length_fit ?? toStringSafe(metadata.rollLengthFit)
    const base = `Rollos: ${rolls ?? "-"} · Costuras: ${seams ?? "-"}${fit ? ` · Fit: ${fit}` : ""}`
    return quality ? `${base} · ${quality}` : base
  }

  if (phase === "compaction") {
    const base = "Compactación registrada"
    return quality ? `${base} · ${quality}` : base
  }

  if (phase === "material") {
    const material = toStringSafe(metadata.tipoMaterial)
    const pasada = toStringSafe(metadata.tipoPasada)
    const valvula = toNumberSafe(metadata.valvula)
    return `Material: ${material ?? "-"} · Pasada: ${pasada ?? "-"} · Válvula: ${valvula ?? "-"}`
  }

  if (phase === "verify") {
    const status =
      toStringSafe(metadata.verificationStatus) ??
      toStringSafe(metadata.status) ??
      "ok"
    return `Verificación: ${status}`
  }

  if (phase === "incident") {
    const type = toStringSafe(metadata.typeOfIncidence)
    return `Incidencia: ${type ?? "-"}`
  }

  return quality ? `Captura registrada · ${quality}` : "Captura registrada"
}

function normalizeSignal(value: unknown): "green" | "yellow" | "red" | null {
  return value === "green" || value === "yellow" || value === "red" ? value : null
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("project")

    if (!projectId) return NextResponse.json({ error: "project is required" }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    const capturesRes = await supabase
      .from("captures")
      .select("id, phase, project_zone_id, capture_session_id, source_id, photo_type, macro_zone, micro_zone, zone, image_url, notes, timestamp, feet_installed, rolls_used, glue_buckets, seams, roll_length_fit, quality_label, metadata")
      .eq("project_id", projectId)
      .order("timestamp", { ascending: false })
      .limit(2000)

    if (capturesRes.error) {
      const message = isObject(capturesRes.error) && typeof capturesRes.error.message === "string" ? capturesRes.error.message : "Database error"
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const captureGroups = new Map<string, CaptureItem>()

    for (const row of (capturesRes.data ?? []) as UnifiedCaptureRow[]) {
      const metadata = isObject(row.metadata) ? row.metadata : {}
      const groupKey = row.capture_session_id ?? row.source_id ?? row.id
      const currentSignal = normalizeSignal(row.quality_label)
      const currentPhotoUrl = row.image_url ? [row.image_url] : []
      const existing = captureGroups.get(groupKey)
      if (!existing) {
        captureGroups.set(groupKey, {
          id: groupKey,
          module: row.phase ?? "capture",
          createdAt: row.timestamp ?? new Date().toISOString(),
          macroZone: row.macro_zone,
          microZone: row.micro_zone,
          projectZoneId: row.project_zone_id,
          photos: currentPhotoUrl,
          photoCaptureIds: row.image_url ? [row.id] : [],
          photoQualityLabels: row.image_url ? [currentSignal] : [],
          summary: formatCaptureSummary(row, metadata),
          metadata,
          sourceTable: "captures",
          editable: false,
          labelEditable: Boolean(row.image_url),
          qualityLabel: currentSignal,
        })
        continue
      }

      if (row.image_url) {
        existing.photos.unshift(row.image_url)
        existing.photoCaptureIds.unshift(row.id)
        existing.photoQualityLabels.unshift(currentSignal)
      }
      if ((row.timestamp ?? "") > existing.createdAt) {
        existing.createdAt = row.timestamp ?? existing.createdAt
      }
      existing.labelEditable = existing.labelEditable || Boolean(row.image_url)
    }

    const sorted = [...captureGroups.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const zonesMap = new Map<string, { key: string; macroZone: string; microZone: string }>()
    for (const capture of sorted) {
      const macro = toStringSafe(capture.macroZone)
      const micro = toStringSafe(capture.microZone)
      if (!macro || !micro) continue
      const key = `${macro}::${micro}`
      if (!zonesMap.has(key)) zonesMap.set(key, { key, macroZone: macro, microZone: micro })
    }

    return NextResponse.json({
      captures: sorted,
      zones: [...zonesMap.values()],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type MutationBody = {
  projectId?: string
  id?: string
  module?: string
  sourceTable?: string
  qualityLabel?: string
  metadata?: Record<string, unknown>
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as MutationBody
    const projectId = toStringSafe(body.projectId)
    const id = toStringSafe(body.id)
    const module = toStringSafe(body.module)
    if (!projectId || !id || !module) {
      return NextResponse.json({ error: "projectId, id, module are required" }, { status: 400 })
    }

    const target = resolveCaptureTable(module)
    if (!target) return NextResponse.json({ error: "Unsupported module" }, { status: 400 })

    const supabase = getSupabaseAdminClient()
    let beforeQuery = supabase.from(target.table).select("*").eq("id", id).eq("project_id", projectId)
    if (target.isFieldRecord && module !== "field_record") {
      beforeQuery = beforeQuery.eq("module", module)
    }
    const beforeRes = await beforeQuery.maybeSingle()
    const beforeData = beforeRes.data ?? null

    let query = supabase.from(target.table).delete().eq("id", id).eq("project_id", projectId)
    if (target.isFieldRecord && module !== "field_record") {
      query = query.eq("module", module)
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recordCaptureEvent({
      projectId,
      sourceTable: target.table,
      captureId: id,
      module,
      action: "delete",
      actorUserId: auth.context.userId,
      actorEmail: auth.context.email,
      beforeData,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as MutationBody
    const projectId = toStringSafe(body.projectId)
    const id = toStringSafe(body.id)
    const module = toStringSafe(body.module)
    const sourceTable = toStringSafe(body.sourceTable)
    const metadata = isObject(body.metadata) ? body.metadata : null
    const qualityLabel =
      body.qualityLabel === "green" || body.qualityLabel === "yellow" || body.qualityLabel === "red"
        ? body.qualityLabel
        : null

    if (!projectId || !id || !module || !metadata) {
      return NextResponse.json({ error: "projectId, id, module, metadata are required" }, { status: 400 })
    }

    if (sourceTable === "captures") {
      const supabase = getSupabaseAdminClient()
      const currentRes = await supabase
        .from("captures")
        .select("metadata, quality_label, phase")
        .eq("id", id)
        .eq("project_id", projectId)
        .single()

      if (currentRes.error) return NextResponse.json({ error: currentRes.error.message }, { status: 500 })

      const beforeMetadata = isObject(currentRes.data?.metadata) ? currentRes.data.metadata : {}
      const { error } = await supabase
        .from("captures")
        .update({
          metadata,
          quality_label: qualityLabel,
        })
        .eq("id", id)
        .eq("project_id", projectId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await recordMetadataVersion({
        projectId,
        sourceTable: "captures",
        captureId: id,
        module: typeof currentRes.data?.phase === "string" ? currentRes.data.phase : module,
        metadata,
        editedBy: auth.context.userId,
        editorEmail: auth.context.email,
      })

      await recordCaptureEvent({
        projectId,
        sourceTable: "captures",
        captureId: id,
        module: typeof currentRes.data?.phase === "string" ? currentRes.data.phase : module,
        action: "update",
        actorUserId: auth.context.userId,
        actorEmail: auth.context.email,
        beforeData: {
          metadata: beforeMetadata,
          quality_label: currentRes.data?.quality_label ?? null,
        },
        afterData: {
          metadata,
          quality_label: qualityLabel,
        },
      })

      return NextResponse.json({ ok: true, metadata, qualityLabel })
    }

    const target = resolveCaptureTable(module)
    if (!target || !target.isFieldRecord) {
      return NextResponse.json({ error: "Only field_record captures are editable for now." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    let currentQuery = supabase
      .from("field_records")
      .select("payload, module")
      .eq("id", id)
      .eq("project_id", projectId)
    if (module !== "field_record") currentQuery = currentQuery.eq("module", module)
    const currentRes = await currentQuery.single()
    if (currentRes.error) return NextResponse.json({ error: currentRes.error.message }, { status: 500 })

    const currentPayload = isObject(currentRes.data?.payload) ? currentRes.data.payload : {}
    const nextPayload = {
      ...currentPayload,
      metadata,
    }

    let updateQuery = supabase
      .from("field_records")
      .update({ payload: nextPayload })
      .eq("id", id)
      .eq("project_id", projectId)
    if (module !== "field_record") updateQuery = updateQuery.eq("module", module)
    const { error } = await updateQuery

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recordMetadataVersion({
      projectId,
      sourceTable: "field_records",
      captureId: id,
      module: module === "field_record" ? (typeof currentRes.data?.module === "string" ? currentRes.data.module : null) : module,
      metadata,
      editedBy: auth.context.userId,
      editorEmail: auth.context.email,
    })

    await recordCaptureEvent({
      projectId,
      sourceTable: "field_records",
      captureId: id,
      module: module === "field_record" ? (typeof currentRes.data?.module === "string" ? currentRes.data.module : null) : module,
      action: "update",
      actorUserId: auth.context.userId,
      actorEmail: auth.context.email,
      beforeData: {
        metadata: extractFieldRecordMetadata(currentPayload),
      },
      afterData: {
        metadata,
      },
    })

    return NextResponse.json({ ok: true, metadata })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
