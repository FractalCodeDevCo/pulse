import { createHash } from "crypto"
import { NextResponse } from "next/server"

import { requireAuth } from "../../../../lib/auth/guard"
import { getSupabaseAdminClient } from "../../../../lib/supabase/server"

export const runtime = "nodejs"

const BACKUP_BUCKET = process.env.SUPABASE_BACKUP_BUCKET || "pulse-backups"
const BACKUP_TABLES = [
  "projects",
  "project_zones_runtime",
  "field_records",
  "roll_installation",
  "material_records",
  "incidences",
  "roll_verification",
  "roll_verifications",
  "zone_daily_snapshots",
] as const

type BackupPayload = {
  version: 1
  createdAt: string
  createdBy: string
  tables: Record<string, unknown[]>
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm"])
  if (!auth.ok) return auth.response

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("backup_snapshots")
      .select("id, storage_bucket, storage_path, row_counts, checksum, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ backups: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm"])
  if (!auth.ok) return auth.response

  try {
    const supabase = getSupabaseAdminClient()
    const tables: Record<string, unknown[]> = {}
    const rowCounts: Record<string, number> = {}

    for (const table of BACKUP_TABLES) {
      const res = await supabase.from(table).select("*").limit(50000)
      if (res.error) {
        if (isMissingRelationError(res.error.message)) {
          tables[table] = []
          rowCounts[table] = 0
          continue
        }
        return NextResponse.json({ error: `[${table}] ${res.error.message}` }, { status: 500 })
      }
      const rows = (res.data ?? []) as unknown[]
      tables[table] = rows
      rowCounts[table] = rows.length
    }

    const createdAt = new Date().toISOString()
    const payload: BackupPayload = {
      version: 1,
      createdAt,
      createdBy: auth.context.userId,
      tables,
    }
    const raw = JSON.stringify(payload)
    const checksum = createHash("sha256").update(raw).digest("hex")
    const stamp = createdAt.replace(/[:.]/g, "-")
    const storagePath = `snapshots/${stamp}-${checksum.slice(0, 12)}.json`

    const upload = await supabase.storage.from(BACKUP_BUCKET).upload(storagePath, Buffer.from(raw, "utf8"), {
      contentType: "application/json",
      upsert: false,
    })
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 })

    const insert = await supabase
      .from("backup_snapshots")
      .insert({
        storage_bucket: BACKUP_BUCKET,
        storage_path: storagePath,
        checksum,
        row_counts: rowCounts,
        created_by: auth.context.userId,
      })
      .select("id, storage_bucket, storage_path, row_counts, checksum, created_at, created_by")
      .single()

    if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 })
    return NextResponse.json({ ok: true, backup: insert.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
