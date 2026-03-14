import { NextResponse } from "next/server"

import {
  buildDailyZoneSnapshots,
  fetchCaptureExportRows,
  getDateRangeBounds,
  normalizeDateParam,
  zoneSnapshotsToCsv,
  ZoneDailySnapshotRow,
} from "../../../../lib/dataScience"
import { getSupabaseAdminClient } from "../../../../lib/supabase/server"

export const runtime = "nodejs"

type SnapshotPostBody = {
  projectId?: string
  fromDate?: string | null
  toDate?: string | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isMissingRelationError(error: unknown): boolean {
  if (!isObject(error)) return false
  return error.code === "42P01"
}

function hasOnConflictConstraintError(message: string): boolean {
  return message.toLowerCase().includes("there is no unique or exclusion constraint matching the on conflict specification")
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

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

async function persistSnapshots(params: {
  projectId: string
  fromDate: string | null
  toDate: string | null
  snapshots: ZoneDailySnapshotRow[]
}) {
  const supabase = getSupabaseAdminClient()
  const bounds = getDateRangeBounds({ fromDate: params.fromDate, toDate: params.toDate })

  if (params.snapshots.length === 0) {
    return { persisted: 0, usedFallbackInsert: false }
  }

  let usedFallbackInsert = false
  for (const batch of chunk(params.snapshots, 500)) {
    const { error } = await supabase
      .from("zone_daily_snapshots")
      .upsert(batch, { onConflict: "project_id,snapshot_date,zone_key" })
    if (!error) continue

    if (isMissingRelationError(error)) {
      throw new Error("Table zone_daily_snapshots does not exist. Run supabase/schema.sql first.")
    }
    if (!hasOnConflictConstraintError(error.message)) {
      throw new Error(error.message)
    }

    usedFallbackInsert = true

    let deleteQuery = supabase
      .from("zone_daily_snapshots")
      .delete()
      .eq("project_id", params.projectId)

    if (bounds.fromDate) deleteQuery = deleteQuery.gte("snapshot_date", bounds.fromDate)
    if (bounds.toDate) deleteQuery = deleteQuery.lte("snapshot_date", bounds.toDate)

    const deleteResult = await deleteQuery
    if (deleteResult.error) throw new Error(deleteResult.error.message)

    for (const insertBatch of chunk(params.snapshots, 500)) {
      const insertResult = await supabase.from("zone_daily_snapshots").insert(insertBatch)
      if (insertResult.error) throw new Error(insertResult.error.message)
    }

    break
  }

  return {
    persisted: params.snapshots.length,
    usedFallbackInsert,
  }
}

async function loadSnapshots(params: {
  projectId: string
  fromDate: string | null
  toDate: string | null
}): Promise<ZoneDailySnapshotRow[]> {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("zone_daily_snapshots")
    .select("*")
    .eq("project_id", params.projectId)
    .order("snapshot_date", { ascending: true })

  if (params.fromDate) query = query.gte("snapshot_date", params.fromDate)
  if (params.toDate) query = query.lte("snapshot_date", params.toDate)

  const { data, error } = await query
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error("Table zone_daily_snapshots does not exist. Run supabase/schema.sql first.")
    }
    throw new Error(error.message)
  }

  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    project_id: toStringSafe(item.project_id) ?? params.projectId,
    snapshot_date: toStringSafe(item.snapshot_date) ?? "",
    zone_key: toStringSafe(item.zone_key) ?? "",
    macro_zone: toStringSafe(item.macro_zone),
    micro_zone: toStringSafe(item.micro_zone),
    cumulative_ft: toNumber(item.cumulative_ft) ?? 0,
    cumulative_botes: toNumber(item.cumulative_botes) ?? 0,
    cumulative_rolls: toNumber(item.cumulative_rolls) ?? 0,
    cumulative_seams: toNumber(item.cumulative_seams) ?? 0,
    captures_count: toNumber(item.captures_count) ?? 0,
    last_capture_at: toStringSafe(item.last_capture_at),
  }))
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SnapshotPostBody
    const projectId = body.projectId?.trim()
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const fromDate = normalizeDateParam(body.fromDate ?? null)
    const toDate = normalizeDateParam(body.toDate ?? null)
    const { rows } = await fetchCaptureExportRows({ projectId, fromDate, toDate })
    const snapshots = buildDailyZoneSnapshots({ projectId, rows, fromDate, toDate })

    const result = await persistSnapshots({
      projectId,
      fromDate,
      toDate,
      snapshots,
    })

    const zoneCount = new Set(snapshots.map((item) => item.zone_key)).size
    return NextResponse.json({
      projectId,
      fromDate,
      toDate,
      snapshotRows: snapshots.length,
      zones: zoneCount,
      persisted: result.persisted,
      usedFallbackInsert: result.usedFallbackInsert,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("project")?.trim()
    if (!projectId) {
      return NextResponse.json({ error: "project is required" }, { status: 400 })
    }

    const fromDate = normalizeDateParam(searchParams.get("from"))
    const toDate = normalizeDateParam(searchParams.get("to"))
    const format = searchParams.get("format")

    const snapshots = await loadSnapshots({
      projectId,
      fromDate,
      toDate,
    })

    if (format === "csv") {
      const csv = zoneSnapshotsToCsv(snapshots)
      const fileName = `pulse-zone-snapshots-${projectId}-${fromDate ?? "all"}-${toDate ?? "all"}.csv`
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
          "X-Pulse-Row-Count": String(snapshots.length),
        },
      })
    }

    return NextResponse.json({
      projectId,
      fromDate,
      toDate,
      rows: snapshots,
      count: snapshots.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
