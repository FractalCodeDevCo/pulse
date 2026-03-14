import { NextResponse } from "next/server"

import { requireAuth } from "../../../../../lib/auth/guard"
import { getSupabaseAdminClient } from "../../../../../lib/supabase/server"

export const runtime = "nodejs"

type RestoreBody = {
  backupId?: string
  apply?: boolean
}

type SnapshotFile = {
  version: number
  createdAt: string
  createdBy: string
  tables: Record<string, unknown[]>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

async function restoreTable(supabase: ReturnType<typeof getSupabaseAdminClient>, table: string, rows: unknown[]) {
  if (rows.length === 0) return null
  const asObjects = rows.filter((item): item is Record<string, unknown> => Boolean(asObject(item)))
  if (asObjects.length === 0) return null

  const hasId = asObjects.every((row) => typeof row.id === "string")
  if (hasId) {
    const upsertRes = await supabase.from(table).upsert(asObjects, { onConflict: "id" })
    if (!upsertRes.error) return null
    return upsertRes.error.message
  }

  const insertRes = await supabase.from(table).insert(asObjects)
  if (insertRes.error) return insertRes.error.message
  return null
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin"])
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as RestoreBody
    const backupId = body.backupId?.trim()
    const apply = body.apply === true
    if (!backupId) return NextResponse.json({ error: "backupId is required." }, { status: 400 })

    const supabase = getSupabaseAdminClient()
    const backupRes = await supabase
      .from("backup_snapshots")
      .select("id, storage_bucket, storage_path, row_counts, created_at")
      .eq("id", backupId)
      .single()

    if (backupRes.error || !backupRes.data) {
      return NextResponse.json({ error: backupRes.error?.message ?? "Backup not found." }, { status: 404 })
    }

    const download = await supabase.storage.from(backupRes.data.storage_bucket).download(backupRes.data.storage_path)
    if (download.error || !download.data) {
      return NextResponse.json({ error: download.error?.message ?? "Failed to read backup file." }, { status: 500 })
    }

    const text = await download.data.text()
    const parsed = JSON.parse(text) as SnapshotFile
    const tableEntries = Object.entries(parsed.tables ?? {})
    const summary = tableEntries.map(([table, rows]) => ({ table, rows: asArray(rows).length }))

    if (!apply) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        backupId,
        createdAt: parsed.createdAt,
        summary,
      })
    }

    const errors: Array<{ table: string; error: string }> = []
    const restored: Array<{ table: string; rows: number }> = []

    for (const [table, rowsValue] of tableEntries) {
      const rows = asArray(rowsValue)
      const error = await restoreTable(supabase, table, rows)
      if (error) {
        errors.push({ table, error })
      } else {
        restored.push({ table, rows: rows.length })
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          backupId,
          restored,
          errors,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, backupId, restored })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
