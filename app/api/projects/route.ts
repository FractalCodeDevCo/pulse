import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { generateProjectZones } from "../../../lib/projects"
import { inferSetupCompleted, normalizeZoneTargets, ZoneTarget } from "../../../lib/projectSetup"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { FieldType } from "../../../types/fieldType"

export const runtime = "nodejs"

type ProjectRow = {
  id?: string | null
  code: string | null
  name: string | null
  sport: string | null
  created_at: string | null
  total_sqft?: number | null
  start_date?: string | null
  crew_name?: string | null
  setup_notes?: string | null
  plan_files?: unknown
  zone_targets?: unknown
  setup_completed?: boolean | null
}

type RequestBody = {
  id?: string
  name?: string
  fieldType?: FieldType
  totalSqft?: number | null
  startDate?: string | null
  crewName?: string
  notes?: string
  planFiles?: string[]
  zoneTargets?: ZoneTarget[]
  setupCompleted?: boolean
  setup?: {
    totalSqft?: number | null
    startDate?: string | null
    crewName?: string
    notes?: string
    planFiles?: string[]
    zoneTargets?: ZoneTarget[]
    setupCompleted?: boolean
  }
}

function normalizeFieldType(value: string | null | undefined): FieldType {
  if (value === "football" || value === "soccer" || value === "beisbol" || value === "softbol") return value
  if (value === "baseball") return "beisbol"
  if (value === "softball") return "softbol"
  return "football"
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

function extractSetup(body: RequestBody, fieldType: FieldType) {
  const source = body.setup ?? body
  const totalSqft = toNullableNumber(source.totalSqft)
  const startDate = typeof source.startDate === "string" && source.startDate ? source.startDate : null
  const crewName = typeof source.crewName === "string" ? source.crewName.trim() : ""
  const notes = typeof source.notes === "string" ? source.notes.trim() : ""
  const planFiles = toStringArray(source.planFiles)
  const zoneTargets = normalizeZoneTargets(fieldType, source.zoneTargets)
  const setupCompleted =
    typeof source.setupCompleted === "boolean"
      ? source.setupCompleted
      : inferSetupCompleted(totalSqft, startDate, crewName, zoneTargets)

  return {
    totalSqft,
    startDate,
    crewName,
    notes,
    planFiles,
    zoneTargets,
    setupCompleted,
  }
}

function mapProjectRow(row: ProjectRow) {
  const fieldType = normalizeFieldType(row.sport)
  const totalSqft = toNullableNumber(row.total_sqft)
  const startDate = typeof row.start_date === "string" && row.start_date ? row.start_date : null
  const crewName = typeof row.crew_name === "string" ? row.crew_name : ""
  const notes = typeof row.setup_notes === "string" ? row.setup_notes : ""
  const planFiles = toStringArray(row.plan_files)
  const zoneTargets = normalizeZoneTargets(fieldType, row.zone_targets)
  const setupCompleted =
    typeof row.setup_completed === "boolean"
      ? row.setup_completed
      : inferSetupCompleted(totalSqft, startDate, crewName, zoneTargets)

  return {
    id: row.code ?? "",
    name: row.name ?? row.code ?? "",
    fieldType,
    createdAt: row.created_at ?? new Date().toISOString(),
    setup: {
      totalSqft,
      startDate,
      crewName,
      notes,
      planFiles,
      zoneTargets,
      setupCompleted,
    },
    setupCompleted,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, ["admin", "pm", "installer"])
    if (!auth.ok) return auth.response
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const projects = ((data ?? []) as ProjectRow[])
      .map(mapProjectRow)
      .filter((project) => Boolean(project.id))

    return NextResponse.json({ projects })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as RequestBody

    if (!body.id || !body.name || !body.fieldType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const fieldType = normalizeFieldType(body.fieldType)
    const setup = extractSetup(body, fieldType)
    const supabase = getSupabaseAdminClient()
    const existingCheck = await supabase.from("projects").select("id, code").eq("code", body.id).limit(1)
    const existedBefore = (existingCheck.data ?? []).length > 0

    const payload = {
      code: body.id,
      name: body.name,
      sport: fieldType,
      total_sqft: setup.totalSqft,
      start_date: setup.startDate,
      crew_name: setup.crewName || null,
      setup_notes: setup.notes || null,
      plan_files: setup.planFiles,
      zone_targets: setup.zoneTargets,
      setup_completed: setup.setupCompleted,
    }

    let { data, error } = await supabase
      .from("projects")
      .upsert(payload, { onConflict: "code" })
      .select("*")
      .single()

    if (error && isMissingColumnError(error.message)) {
      const fallback = await supabase
        .from("projects")
        .upsert(
          {
            code: body.id,
            name: body.name,
            sport: fieldType,
          },
          { onConflict: "code" },
        )
        .select("*")
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!existedBefore && data) {
      const runtimeZones = generateProjectZones(body.id, fieldType).map((zone) => ({
        project_code: body.id,
        project_uuid: (data as ProjectRow).id ?? null,
        zone_name: zone.microZone,
        macro_zone: zone.macroZone,
        micro_zone: zone.microZone,
        zone_record_type: zone.type,
        zone_order: zone.order,
        is_deletable: zone.isDeletable,
      }))

      const runtimeInsert = await supabase.from("project_zones_runtime").upsert(runtimeZones, {
        onConflict: "project_code,macro_zone,micro_zone",
      })

      if (
        runtimeInsert.error &&
        !isMissingColumnError(runtimeInsert.error.message) &&
        !isMissingRelationError(runtimeInsert.error.message)
      ) {
        console.error("[projects-api] runtime_zones_persist_failed", {
          project: body.id,
          error: runtimeInsert.error.message,
        })
      }
    }

    return NextResponse.json({ project: mapProjectRow(data as ProjectRow) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
