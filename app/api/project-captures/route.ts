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
  summary: string
  metadata: Record<string, unknown>
  sourceTable: string
  editable: boolean
}

type FieldRecordRow = {
  id: string
  module: string | null
  macro_zone: string | null
  micro_zone: string | null
  payload: unknown
  created_at: string | null
}

type RollInstallationRow = {
  id: string
  macro_zone: string | null
  micro_zone: string | null
  project_zone_id: string | null
  photos: unknown
  roll_length_fit: string | null
  total_rolls_used: number | null
  total_seams: number | null
  created_at: string | null
}

type MaterialRow = {
  id: string
  fotos: unknown
  tipo_material: string | null
  tipo_pasada: string | null
  valvula: number | null
  created_at: string | null
}

type IncidenceRow = {
  id: string
  macro_zone: string | null
  micro_zone: string | null
  project_zone_id: string | null
  type_of_incidence: string | null
  photos: unknown
  created_at: string | null
}

type RollVerificationRow = {
  id: string
  macro_zone: string | null
  micro_zone: string | null
  project_zone_id: string | null
  status: string | null
  photo_url: string | null
  created_at: string | null
}

type RollVerificationsRow = {
  id: string
  macro_zone: string | null
  micro_zone: string | null
  status: string | null
  label_photo_url: string | null
  created_at: string | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function toRollInstallationPhotoArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const photos: string[] = []

  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      photos.push(item)
      continue
    }
    if (isObject(item) && typeof item.url === "string" && item.url.length > 0) {
      photos.push(item.url)
    }
  }

  return photos
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

function formatFieldRecordSummary(module: string | null, metadata: Record<string, unknown>): string {
  if (module === "flow") {
    const phases = Array.isArray(metadata.phases_completed)
      ? metadata.phases_completed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : []
    const details = isObject(metadata.details) ? metadata.details : {}
    const visionLabelRaw = typeof details.visionLabel === "string" ? details.visionLabel.toLowerCase() : ""
    const visionLabel = visionLabelRaw === "ok" || visionLabelRaw === "check" || visionLabelRaw === "rework" ? visionLabelRaw.toUpperCase() : null
    const base = phases.length > 0 ? `Flow: ${phases.join(" -> ")}` : "Flow guardado"
    return visionLabel ? `${base} · ${visionLabel}` : base
  }

  if (module === "pegada") {
    const ft = metadata.ftTotales
    const botes = metadata.botesUsados
    return `Ft: ${typeof ft === "number" ? ft : "-"} · Botes: ${typeof botes === "number" ? botes : "-"}`
  }

  if (module === "rollos") {
    const rolls = metadata.totalRolls
    const seams = metadata.totalSeams
    return `Rollos: ${typeof rolls === "number" ? rolls : "-"} · Costuras: ${typeof seams === "number" ? seams : "-"}`
  }

  if (module === "compactacion") {
    return `Compactación registrada`
  }

  return "Captura registrada"
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("project")

    if (!projectId) return NextResponse.json({ error: "project is required" }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    const [fieldRecordsRes, rollInstallationRes, materialRes, incidencesRes, rollVerificationRes, rollVerificationsRes] =
      await Promise.all([
        supabase
          .from("field_records")
          .select("id, module, macro_zone, micro_zone, payload, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("roll_installation")
          .select("id, macro_zone, micro_zone, project_zone_id, photos, roll_length_fit, total_rolls_used, total_seams, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("material_records")
          .select("id, fotos, tipo_material, tipo_pasada, valvula, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("incidences")
          .select("id, macro_zone, micro_zone, project_zone_id, type_of_incidence, photos, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("roll_verification")
          .select("id, macro_zone, micro_zone, project_zone_id, status, photo_url, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("roll_verifications")
          .select("id, macro_zone, micro_zone, status, label_photo_url, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1000),
      ])

    const errors = [
      fieldRecordsRes.error,
      rollInstallationRes.error,
      materialRes.error,
      incidencesRes.error,
      rollVerificationRes.error,
      rollVerificationsRes.error,
    ].filter(Boolean)

    for (const error of errors) {
      if (!isMissingRelationError(error)) {
        const message = isObject(error) && typeof error.message === "string" ? error.message : "Database error"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }

    const captures: CaptureItem[] = []

    for (const row of (fieldRecordsRes.data ?? []) as FieldRecordRow[]) {
      const payload = isObject(row.payload) ? row.payload : {}
      const metadata = isObject(payload.metadata) ? payload.metadata : payload
      const photos = toStringArray(payload.photosUrls)

      let projectZoneId: string | null = null
      if (typeof metadata.project_zone_id === "string") projectZoneId = metadata.project_zone_id

      if (photos.length === 0 && isObject(metadata.evidencePhotos)) {
        const values = Object.values(metadata.evidencePhotos).filter((item): item is string => typeof item === "string")
        photos.push(...values)
      }

      captures.push({
        id: row.id,
        module: row.module ?? "field_record",
        createdAt: row.created_at ?? new Date().toISOString(),
        macroZone: row.macro_zone,
        microZone: row.micro_zone,
        projectZoneId,
        photos,
        summary: formatFieldRecordSummary(row.module, metadata),
        metadata,
        sourceTable: "field_records",
        editable: true,
      })
    }

    for (const row of (rollInstallationRes.data ?? []) as RollInstallationRow[]) {
      captures.push({
        id: row.id,
        module: "roll_installation",
        createdAt: row.created_at ?? new Date().toISOString(),
        macroZone: row.macro_zone,
        microZone: row.micro_zone,
        projectZoneId: row.project_zone_id,
        photos: toRollInstallationPhotoArray(row.photos),
        summary: `Roll Fit: ${row.roll_length_fit ?? "-"} · Rollos: ${row.total_rolls_used ?? "-"} · Costuras: ${row.total_seams ?? "-"}`,
        metadata: {},
        sourceTable: "roll_installation",
        editable: false,
      })
    }

    for (const row of (materialRes.data ?? []) as MaterialRow[]) {
      captures.push({
        id: row.id,
        module: "material",
        createdAt: row.created_at ?? new Date().toISOString(),
        macroZone: null,
        microZone: null,
        projectZoneId: null,
        photos: toStringArray(row.fotos),
        summary: `Material: ${row.tipo_material ?? "-"} · Pasada: ${row.tipo_pasada ?? "-"} · Válvula: ${row.valvula ?? "-"}`,
        metadata: {},
        sourceTable: "material_records",
        editable: false,
      })
    }

    for (const row of (incidencesRes.data ?? []) as IncidenceRow[]) {
      captures.push({
        id: row.id,
        module: "incidence",
        createdAt: row.created_at ?? new Date().toISOString(),
        macroZone: row.macro_zone,
        microZone: row.micro_zone,
        projectZoneId: row.project_zone_id,
        photos: toStringArray(row.photos),
        summary: `Incidencia: ${row.type_of_incidence ?? "-"}`,
        metadata: {},
        sourceTable: "incidences",
        editable: false,
      })
    }

    for (const row of (rollVerificationRes.data ?? []) as RollVerificationRow[]) {
      captures.push({
        id: row.id,
        module: "roll_verification",
        createdAt: row.created_at ?? new Date().toISOString(),
        macroZone: row.macro_zone,
        microZone: row.micro_zone,
        projectZoneId: row.project_zone_id,
        photos: row.photo_url ? [row.photo_url] : [],
        summary: `Verificación: ${row.status ?? "-"}`,
        metadata: {},
        sourceTable: "roll_verification",
        editable: false,
      })
    }

    for (const row of (rollVerificationsRes.data ?? []) as RollVerificationsRow[]) {
      captures.push({
        id: row.id,
        module: "roll_verifications",
        createdAt: row.created_at ?? new Date().toISOString(),
        macroZone: row.macro_zone,
        microZone: row.micro_zone,
        projectZoneId: null,
        photos: row.label_photo_url ? [row.label_photo_url] : [],
        summary: `Verificación: ${row.status ?? "-"}`,
        metadata: {},
        sourceTable: "roll_verifications",
        editable: false,
      })
    }

    const sorted = captures.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

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
  const auth = await requireAuth(request, ["admin", "pm"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as MutationBody
    const projectId = toStringSafe(body.projectId)
    const id = toStringSafe(body.id)
    const module = toStringSafe(body.module)
    const metadata = isObject(body.metadata) ? body.metadata : null

    if (!projectId || !id || !module || !metadata) {
      return NextResponse.json({ error: "projectId, id, module, metadata are required" }, { status: 400 })
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
