import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { recordCaptureEvent } from "../../../lib/audit/captureAudit"
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

type ZoneOption = {
  key: string
  macroZone: string
  microZone: string
}

type CaptureRow = {
  id: string
  timestamp: string | null
  module: string | null
  phase: string | null
  project_zone_id: string | null
  macro_zone: string | null
  micro_zone: string | null
  image_url: string | null
  metadata: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
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

function moduleLabel(module: string | null, phase: string | null): string {
  const value = (module ?? phase ?? "capture").toLowerCase()
  if (value === "pegada" || value === "glue") return "Adhesive"
  if (value === "roll-installation" || value === "roll_installation" || value === "roll_install") return "Roll Installation"
  if (value === "material") return "Material"
  if (value === "incidence" || value === "incident") return "Incident"
  if (value === "flow") return "Flow"
  if (value === "compaction" || value === "compactacion") return "Compaction"
  if (value === "sewing") return "Sewing"
  if (value === "cut") return "Cut"
  if (value === "align") return "Align"
  return value
}

function buildSummary(row: CaptureRow, metadata: Record<string, unknown>): string {
  const phase = toStringSafe(row.phase)
  const label = moduleLabel(toStringSafe(row.module), phase)
  const feet = toNumber(metadata.feetInstalled ?? metadata.feet_installed ?? metadata.ftTotales ?? metadata.ft_totales ?? metadata.ft)
  const glue = toNumber(metadata.glueBuckets ?? metadata.glue_buckets ?? metadata.botesUsados ?? metadata.botes_usados ?? metadata.botes)
  const rolls = toNumber(metadata.totalRollsUsed ?? metadata.total_rolls_used ?? metadata.totalRolls)
  const seams = toNumber(metadata.totalSeams ?? metadata.total_seams ?? metadata.seams)

  if (phase === "glue" || label === "Adhesive") {
    return `Ft: ${feet ?? "-"} · Buckets: ${glue ?? "-"}`
  }
  if (phase === "roll_install" || label === "Roll Installation") {
    return `Rolls: ${rolls ?? "-"} · Seams: ${seams ?? "-"}`
  }
  if (label === "Material") {
    return `Material record`
  }
  return label
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("project")
    if (!projectId) {
      return NextResponse.json({ error: "project is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("captures")
      .select("id,timestamp,module,phase,project_zone_id,macro_zone,micro_zone,image_url,metadata")
      .eq("project_id", projectId)
      .order("timestamp", { ascending: false })
      .limit(5000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const grouped = new Map<string, CaptureItem>()
    for (const row of (data ?? []) as CaptureRow[]) {
      const metadata = isObject(row.metadata) ? row.metadata : {}
      const moduleValue = toStringSafe(row.module) ?? toStringSafe(row.phase) ?? "capture"
      const key = [
        row.project_zone_id ?? "",
        row.macro_zone ?? "",
        row.micro_zone ?? "",
        moduleValue,
        row.timestamp ?? "",
      ].join("|")

      const existing = grouped.get(key)
      if (existing) {
        if (row.image_url) existing.photos.push(row.image_url)
        continue
      }

      grouped.set(key, {
        id: row.id,
        module: moduleValue,
        createdAt: row.timestamp ?? new Date().toISOString(),
        macroZone: row.macro_zone,
        microZone: row.micro_zone,
        projectZoneId: row.project_zone_id,
        photos: row.image_url ? [row.image_url] : [],
        summary: buildSummary(row, metadata),
        metadata,
        sourceTable: "captures",
        editable: false,
      })
    }

    const captures = [...grouped.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const zonesMap = new Map<string, ZoneOption>()
    for (const capture of captures) {
      const macro = toStringSafe(capture.macroZone)
      const micro = toStringSafe(capture.microZone)
      if (!macro || !micro) continue
      const key = `${macro}::${micro}`
      if (!zonesMap.has(key)) {
        zonesMap.set(key, { key, macroZone: macro, microZone: micro })
      }
    }

    return NextResponse.json({
      captures,
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
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as MutationBody
    const projectId = toStringSafe(body.projectId)
    const id = toStringSafe(body.id)
    if (!projectId || !id) {
      return NextResponse.json({ error: "projectId and id are required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const beforeRes = await supabase.from("captures").select("*").eq("project_id", projectId).eq("id", id).maybeSingle()
    const beforeData = beforeRes.data ?? null

    const { error } = await supabase.from("captures").delete().eq("project_id", projectId).eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recordCaptureEvent({
      projectId,
      sourceTable: "captures",
      captureId: id,
      module: body.module ?? null,
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


