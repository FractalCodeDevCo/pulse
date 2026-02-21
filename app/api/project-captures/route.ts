import { NextResponse } from "next/server"

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

function formatFieldRecordSummary(module: string | null, metadata: Record<string, unknown>): string {
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
