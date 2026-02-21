import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { FieldType } from "../../../types/fieldType"

export const runtime = "nodejs"

type ProjectRow = {
  code: string | null
  name: string | null
  sport: string | null
  created_at: string | null
}

type RequestBody = {
  id?: string
  name?: string
  fieldType?: FieldType
}

function normalizeFieldType(value: string | null | undefined): FieldType {
  if (value === "football" || value === "soccer" || value === "beisbol" || value === "softbol") return value
  if (value === "baseball") return "beisbol"
  if (value === "softball") return "softbol"
  return "football"
}

function mapProjectRow(row: ProjectRow) {
  return {
    id: row.code ?? "",
    name: row.name ?? row.code ?? "",
    fieldType: normalizeFieldType(row.sport),
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("projects")
      .select("code, name, sport, created_at")
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
  try {
    const body = (await request.json()) as RequestBody

    if (!body.id || !body.name || !body.fieldType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const fieldType = normalizeFieldType(body.fieldType)
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from("projects")
      .upsert(
        {
          code: body.id,
          name: body.name,
          sport: fieldType,
        },
        { onConflict: "code" },
      )
      .select("code, name, sport, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ project: mapProjectRow(data as ProjectRow) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
