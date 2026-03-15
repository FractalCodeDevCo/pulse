import { getSupabaseAdminClient } from "./supabase/server"

type Primitive = string | number | boolean | null

export const CAPTURE_EXPORT_COLUMNS = [
  "project_id",
  "created_at",
  "capture_date",
  "module",
  "capture_status",
  "vision_label",
  "capture_session_id",
  "project_zone_id",
  "field_type",
  "macro_zone",
  "micro_zone",
  "zone",
  "ft_totales",
  "botes_usados",
  "total_rolls_used",
  "total_seams",
  "roll_length_fit",
  "compaction_method",
  "compaction_surface_firm",
  "compaction_moisture_ok",
  "compaction_double",
  "tipo_material",
  "tipo_pasada",
  "valvula",
  "bolsas_esperadas",
  "bolsas_utilizadas",
  "desviacion_material",
  "status_color_material",
  "photos_count",
  "observaciones",
] as const

export type CaptureExportColumn = (typeof CAPTURE_EXPORT_COLUMNS)[number]
export type CaptureExportRow = Record<CaptureExportColumn, Primitive>

export const ZONE_SNAPSHOT_COLUMNS = [
  "project_id",
  "snapshot_date",
  "zone_key",
  "macro_zone",
  "micro_zone",
  "cumulative_ft",
  "cumulative_botes",
  "cumulative_rolls",
  "cumulative_seams",
  "captures_count",
  "last_capture_at",
] as const

export type ZoneSnapshotColumn = (typeof ZONE_SNAPSHOT_COLUMNS)[number]
export type ZoneDailySnapshotRow = Record<ZoneSnapshotColumn, Primitive>

type DateRangeInput = {
  fromDate: string | null
  toDate: string | null
}

type DateRangeBounds = {
  fromDate: string | null
  toDate: string | null
  fromIso: string | null
  toExclusiveIso: string | null
}

type FetchCaptureExportResult = {
  rows: CaptureExportRow[]
  relationWarnings: string[]
}

type ZoneMetricEvent = {
  createdAt: string
  dateKey: string
  zoneKey: string
  macroZone: string | null
  microZone: string | null
  ft: number
  botes: number
  rolls: number
  seams: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isMissingRelationError(error: unknown): boolean {
  if (!isObject(error)) return false
  return error.code === "42P01"
}

function toStringSafe(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim()
    if (lower === "true") return true
    if (lower === "false") return false
  }
  return null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function toPhotoArrayCount(value: unknown): number {
  if (!Array.isArray(value)) return 0
  let count = 0
  for (const item of value) {
    if (typeof item === "string" && item) {
      count += 1
      continue
    }
    if (isObject(item) && typeof item.url === "string" && item.url) {
      count += 1
    }
  }
  return count
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toStringSafe(source[key])
    if (value) return value
  }
  return null
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(source[key])
    if (value !== null) return value
  }
  return null
}

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = toBoolean(source[key])
    if (value !== null) return value
  }
  return null
}

function normalizeCaptureStatus(value: unknown): "complete" | "incomplete" {
  return value === "incomplete" ? "incomplete" : "complete"
}

function nextDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map((chunk) => Number(chunk))
  const next = new Date(Date.UTC(year, (month || 1) - 1, day || 1))
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

function dateKeyToIsoStart(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`
}

function toDateKey(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export function normalizeDateParam(value: string | null): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return value
}

export function getDateRangeBounds(input: DateRangeInput): DateRangeBounds {
  let fromDate = normalizeDateParam(input.fromDate)
  let toDate = normalizeDateParam(input.toDate)

  if (fromDate && toDate && fromDate > toDate) {
    const swap = fromDate
    fromDate = toDate
    toDate = swap
  }

  return {
    fromDate,
    toDate,
    fromIso: fromDate ? dateKeyToIsoStart(fromDate) : null,
    toExclusiveIso: toDate ? dateKeyToIsoStart(nextDay(toDate)) : null,
  }
}

function csvEscape(value: Primitive): string {
  if (value === null) return ""
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export function rowsToCsv<T extends string>(columns: readonly T[], rows: Record<T, Primitive>[]): string {
  const header = columns.join(",")
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))
  return [header, ...body].join("\n")
}

function applyDateRangeColumn<T>(query: T, bounds: DateRangeBounds, column: string): T {
  let nextQuery = query as unknown as {
    gte: (column: string, value: string) => unknown
    lt: (column: string, value: string) => unknown
  }
  if (bounds.fromIso) nextQuery = nextQuery.gte(column, bounds.fromIso) as typeof nextQuery
  if (bounds.toExclusiveIso) nextQuery = nextQuery.lt(column, bounds.toExclusiveIso) as typeof nextQuery
  return nextQuery as unknown as T
}

function applyDateRange<T>(query: T, bounds: DateRangeBounds): T {
  return applyDateRangeColumn(query, bounds, "created_at")
}

export async function fetchCaptureExportRows(params: {
  projectId: string
  fromDate: string | null
  toDate: string | null
}): Promise<FetchCaptureExportResult> {
  const projectId = params.projectId
  const bounds = getDateRangeBounds({ fromDate: params.fromDate, toDate: params.toDate })
  const supabase = getSupabaseAdminClient()

  const capturesQuery = applyDateRangeColumn(
    supabase.from("captures").select("*").eq("project_id", projectId).order("timestamp", { ascending: true }),
    bounds,
    "timestamp",
  )

  const capturesRes = await capturesQuery
  const relationWarnings: string[] = []

  if (capturesRes.error && !isMissingRelationError(capturesRes.error)) throw new Error(capturesRes.error.message)
  if (capturesRes.error && isMissingRelationError(capturesRes.error)) relationWarnings.push("captures")

  const rows: CaptureExportRow[] = []

  for (const rawRow of (capturesRes.data ?? []) as Record<string, unknown>[]) {
    const metadata = isObject(rawRow.metadata) ? rawRow.metadata : {}
    const details = isObject(metadata.details) ? metadata.details : {}
    const createdAt = toStringSafe(rawRow.timestamp) ?? new Date().toISOString()
    const phase = toStringSafe(rawRow.phase) ?? "capture"
    const macroZone = toStringSafe(rawRow.macro_zone) ?? pickString(metadata, ["macro_zone", "macroZone"])
    const microZone = toStringSafe(rawRow.micro_zone) ?? pickString(metadata, ["micro_zone", "microZone"])
    const zone = toStringSafe(rawRow.zone) ?? pickString(metadata, ["zone"])

    rows.push({
      project_id: projectId,
      created_at: createdAt,
      capture_date: createdAt.slice(0, 10),
      module: phase,
      capture_status: normalizeCaptureStatus(rawRow.capture_status),
      vision_label:
        toStringSafe(rawRow.quality_label) ??
        pickString(details, ["visionLabel", "vision_label"]) ??
        pickString(metadata, ["visionLabel", "vision_label"]),
      capture_session_id:
        toStringSafe(rawRow.capture_session_id) ??
        pickString(metadata, ["capture_session_id", "captureSessionId"]),
      project_zone_id:
        toStringSafe(rawRow.project_zone_id) ??
        pickString(metadata, ["project_zone_id", "projectZoneId"]),
      field_type: toStringSafe(rawRow.field_type) ?? pickString(metadata, ["fieldType", "field_type"]),
      macro_zone: macroZone,
      micro_zone: microZone,
      zone: zone ?? microZone ?? macroZone,
      ft_totales: toNumber(rawRow.feet_installed) ?? pickNumber(metadata, ["ftTotales", "ft_totales", "ft", "feet"]),
      botes_usados: toNumber(rawRow.glue_buckets) ?? pickNumber(metadata, ["botesUsados", "botes_usados", "botes"]),
      total_rolls_used: toNumber(rawRow.rolls_used) ?? pickNumber(metadata, ["totalRollsUsed", "total_rolls_used", "totalRolls"]),
      total_seams: toNumber(rawRow.seams) ?? pickNumber(metadata, ["totalSeams", "total_seams", "seams"]),
      roll_length_fit: toStringSafe(rawRow.roll_length_fit) ?? pickString(metadata, ["roll_length_fit", "rollLengthFit", "rollLengthStatus"]),
      compaction_method: toStringSafe(rawRow.compaction_method) ?? pickString(metadata, ["compaction_method", "compactionMethod", "compactacionType"]),
      compaction_surface_firm: toBoolean(rawRow.compaction_surface_firm) ?? pickBoolean(metadata, ["compaction_surface_firm", "surfaceFirm"]),
      compaction_moisture_ok: pickBoolean(metadata, ["compaction_moisture_ok", "moistureOk"]),
      compaction_double: pickBoolean(metadata, ["compaction_double", "doubleCompaction"]),
      tipo_material: pickString(metadata, ["tipoMaterial", "tipo_material"]),
      tipo_pasada: pickString(metadata, ["tipoPasada", "tipo_pasada"]),
      valvula: pickNumber(metadata, ["valvula", "valve"]),
      bolsas_esperadas: pickNumber(metadata, ["bolsasEsperadas", "bolsas_esperadas"]),
      bolsas_utilizadas: pickNumber(metadata, ["bolsasUtilizadas", "bolsas_utilizadas"]),
      desviacion_material: pickNumber(metadata, ["desviacion", "deviation"]),
      status_color_material: pickString(metadata, ["status_color", "statusColor"]),
      photos_count: toStringSafe(rawRow.image_url) ? 1 : 0,
      observaciones: toStringSafe(rawRow.notes) ?? pickString(metadata, ["observaciones", "observations", "notes"]),
    })
  }

  rows.sort((a, b) => {
    if (a.created_at === b.created_at) return String(a.module).localeCompare(String(b.module))
    return String(a.created_at).localeCompare(String(b.created_at))
  })

  return {
    rows,
    relationWarnings,
  }
}

export function captureRowsToCsv(rows: CaptureExportRow[]): string {
  return rowsToCsv(CAPTURE_EXPORT_COLUMNS, rows)
}

function toMetricEvent(row: CaptureExportRow): ZoneMetricEvent | null {
  const macroZone = toStringSafe(row.macro_zone)
  const microZone = toStringSafe(row.micro_zone)
  const zoneText = toStringSafe(row.zone)

  let zoneKey: string | null = null
  if (macroZone && microZone) zoneKey = `${macroZone}::${microZone}`
  else if (macroZone) zoneKey = `${macroZone}::(sin-micro)`
  else if (zoneText) zoneKey = zoneText
  if (!zoneKey) return null

  const createdAt = toStringSafe(row.created_at)
  const dateKey = toDateKey(createdAt)
  if (!createdAt || !dateKey) return null

  return {
    createdAt,
    dateKey,
    zoneKey,
    macroZone,
    microZone,
    ft: toNumber(row.ft_totales) ?? 0,
    botes: toNumber(row.botes_usados) ?? 0,
    rolls: toNumber(row.total_rolls_used) ?? 0,
    seams: toNumber(row.total_seams) ?? 0,
  }
}

export function buildDailyZoneSnapshots(params: {
  projectId: string
  rows: CaptureExportRow[]
  fromDate: string | null
  toDate: string | null
}): ZoneDailySnapshotRow[] {
  const events = params.rows
    .map((row) => toMetricEvent(row))
    .filter((item): item is ZoneMetricEvent => Boolean(item))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (events.length === 0) return []

  const bounds = getDateRangeBounds({ fromDate: params.fromDate, toDate: params.toDate })
  const firstDate = bounds.fromDate ?? events[0].dateKey
  const lastDate = bounds.toDate ?? events[events.length - 1].dateKey

  const eventsByDate = new Map<string, ZoneMetricEvent[]>()
  for (const event of events) {
    if (event.dateKey < firstDate || event.dateKey > lastDate) continue
    const bucket = eventsByDate.get(event.dateKey) ?? []
    bucket.push(event)
    eventsByDate.set(event.dateKey, bucket)
  }

  const accumByZone = new Map<
    string,
    {
      macroZone: string | null
      microZone: string | null
      cumulativeFt: number
      cumulativeBotes: number
      cumulativeRolls: number
      cumulativeSeams: number
      capturesCount: number
      lastCaptureAt: string | null
    }
  >()

  const snapshots: ZoneDailySnapshotRow[] = []
  let cursor = firstDate

  while (cursor <= lastDate) {
    const dayEvents = eventsByDate.get(cursor) ?? []
    for (const event of dayEvents) {
      const acc = accumByZone.get(event.zoneKey) ?? {
        macroZone: event.macroZone,
        microZone: event.microZone,
        cumulativeFt: 0,
        cumulativeBotes: 0,
        cumulativeRolls: 0,
        cumulativeSeams: 0,
        capturesCount: 0,
        lastCaptureAt: null,
      }

      acc.macroZone = event.macroZone ?? acc.macroZone
      acc.microZone = event.microZone ?? acc.microZone
      acc.cumulativeFt += event.ft
      acc.cumulativeBotes += event.botes
      acc.cumulativeRolls += event.rolls
      acc.cumulativeSeams += event.seams
      acc.capturesCount += 1
      acc.lastCaptureAt = acc.lastCaptureAt && acc.lastCaptureAt > event.createdAt ? acc.lastCaptureAt : event.createdAt

      accumByZone.set(event.zoneKey, acc)
    }

    for (const [zoneKey, acc] of accumByZone.entries()) {
      snapshots.push({
        project_id: params.projectId,
        snapshot_date: cursor,
        zone_key: zoneKey,
        macro_zone: acc.macroZone,
        micro_zone: acc.microZone,
        cumulative_ft: Number(acc.cumulativeFt.toFixed(4)),
        cumulative_botes: Number(acc.cumulativeBotes.toFixed(4)),
        cumulative_rolls: Math.round(acc.cumulativeRolls),
        cumulative_seams: Math.round(acc.cumulativeSeams),
        captures_count: acc.capturesCount,
        last_capture_at: acc.lastCaptureAt,
      })
    }

    cursor = nextDay(cursor)
  }

  return snapshots
}

export function zoneSnapshotsToCsv(rows: ZoneDailySnapshotRow[]): string {
  return rowsToCsv(ZONE_SNAPSHOT_COLUMNS, rows)
}

export const VISION_DATASET_COLUMNS = [
  "project_id",
  "capture_id",
  "source",
  "module",
  "created_at",
  "capture_date",
  "capture_session_id",
  "project_zone_id",
  "field_type",
  "macro_zone",
  "micro_zone",
  "phase_primary",
  "phase_list",
  "vision_label",
  "image_url",
  "incidence_type",
] as const

export type VisionDatasetColumn = (typeof VISION_DATASET_COLUMNS)[number]
export type VisionDatasetRow = Record<VisionDatasetColumn, Primitive>

type FetchVisionDatasetResult = {
  rows: VisionDatasetRow[]
  relationWarnings: string[]
}

function normalizeVisionLabel(value: string | null): "ok" | "check" | "rework" | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "ok" || normalized === "check" || normalized === "rework") return normalized
  return null
}

function normalizePhaseList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

export async function fetchVisionDatasetRows(params: {
  projectId: string
  fromDate: string | null
  toDate: string | null
  includeIncidence: boolean
}): Promise<FetchVisionDatasetResult> {
  const projectId = params.projectId
  const bounds = getDateRangeBounds({ fromDate: params.fromDate, toDate: params.toDate })
  const supabase = getSupabaseAdminClient()

  const capturesQuery = applyDateRangeColumn(
    supabase
      .from("captures")
      .select("id, project_zone_id, capture_session_id, field_type, macro_zone, micro_zone, phase, image_url, quality_label, metadata, timestamp")
      .eq("project_id", projectId)
      .not("quality_label", "is", null)
      .order("timestamp", { ascending: true }),
    bounds,
    "timestamp",
  )

  const incidenceQuery = params.includeIncidence
    ? applyDateRangeColumn(
        supabase
          .from("captures")
          .select("id, project_zone_id, field_type, macro_zone, micro_zone, image_url, timestamp, metadata")
          .eq("project_id", projectId)
          .eq("phase", "incident")
          .order("timestamp", { ascending: true }),
        bounds,
        "timestamp",
      )
    : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null })

  const [flowRes, incidenceRes] = await Promise.all([capturesQuery, incidenceQuery])
  const relationWarnings: string[] = []

  if (flowRes.error && !isMissingRelationError(flowRes.error)) throw new Error(flowRes.error.message)
  if (incidenceRes.error && !isMissingRelationError(incidenceRes.error)) throw new Error(incidenceRes.error.message)

  if (flowRes.error && isMissingRelationError(flowRes.error)) relationWarnings.push("captures")
  if (incidenceRes.error && isMissingRelationError(incidenceRes.error)) relationWarnings.push("captures")

  const rows: VisionDatasetRow[] = []

  for (const rawRow of (flowRes.data ?? []) as Record<string, unknown>[]) {
    const metadata = isObject(rawRow.metadata) ? rawRow.metadata : {}
    const label = normalizeVisionLabel(toStringSafe(rawRow.quality_label) ?? pickString(metadata, ["visionLabel", "vision_label"]))
    const imageUrl = toStringSafe(rawRow.image_url)
    if (!label || !imageUrl) continue

    const createdAt = toStringSafe(rawRow.timestamp) ?? new Date().toISOString()
    const phasePrimary = toStringSafe(rawRow.phase)?.toUpperCase() ?? "CAPTURE"

    rows.push({
      project_id: projectId,
      capture_id: toStringSafe(rawRow.id),
      source: "capture",
      module: toStringSafe(rawRow.phase) ?? "capture",
      created_at: createdAt,
      capture_date: createdAt.slice(0, 10),
      capture_session_id: toStringSafe(rawRow.capture_session_id),
      project_zone_id: toStringSafe(rawRow.project_zone_id),
      field_type: toStringSafe(rawRow.field_type),
      macro_zone: toStringSafe(rawRow.macro_zone),
      micro_zone: toStringSafe(rawRow.micro_zone),
      phase_primary: phasePrimary,
      phase_list: phasePrimary,
      vision_label: label,
      image_url: imageUrl,
      incidence_type: null,
    })
  }

  for (const rawRow of (incidenceRes.data ?? []) as Record<string, unknown>[]) {
    const imageUrl = toStringSafe(rawRow.image_url)
    if (!imageUrl) continue
    const metadata = isObject(rawRow.metadata) ? rawRow.metadata : {}
    const createdAt = toStringSafe(rawRow.timestamp) ?? new Date().toISOString()
    const incidenceType = pickString(metadata, ["typeOfIncidence", "type_of_incidence"])

    rows.push({
      project_id: projectId,
      capture_id: toStringSafe(rawRow.id),
      source: "incidence",
      module: "incident",
      created_at: createdAt,
      capture_date: createdAt.slice(0, 10),
      capture_session_id: null,
      project_zone_id: toStringSafe(rawRow.project_zone_id),
      field_type: toStringSafe(rawRow.field_type),
      macro_zone: toStringSafe(rawRow.macro_zone),
      micro_zone: toStringSafe(rawRow.micro_zone),
      phase_primary: "INCIDENT",
      phase_list: "INCIDENT",
      vision_label: "rework",
      image_url: imageUrl,
      incidence_type: incidenceType,
    })
  }

  rows.sort((a, b) => {
    if (a.created_at === b.created_at) return String(a.source).localeCompare(String(b.source))
    return String(a.created_at).localeCompare(String(b.created_at))
  })

  return {
    rows,
    relationWarnings,
  }
}

export function visionDatasetRowsToCsv(rows: VisionDatasetRow[]): string {
  return rowsToCsv(VISION_DATASET_COLUMNS, rows)
}
