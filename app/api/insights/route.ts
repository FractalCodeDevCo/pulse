import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type InsightStatus = "draft" | "published"

type InsightRow = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  status: InsightStatus
  created_at: string
  updated_at: string
}

type InsightBody = {
  id?: string
  slug?: string
  title?: string
  summary?: string
  body?: string
  status?: InsightStatus
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  return (error as { code?: string }).code === "42P01"
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDraft = searchParams.get("includeDraft") === "1"
    const supabase = getSupabaseAdminClient()

    let query = supabase.from("technical_insights").select("*").order("created_at", { ascending: false }).limit(200)
    if (!includeDraft) query = query.eq("status", "published")

    const { data, error } = await query
    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({
          insights: [],
          warning: "Table technical_insights missing. Run supabase/schema.sql.",
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insights: (data ?? []) as InsightRow[] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InsightBody
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const summary = typeof body.summary === "string" ? body.summary.trim() : ""
    const content = typeof body.body === "string" ? body.body.trim() : ""
    const status: InsightStatus = body.status === "published" ? "published" : "draft"
    const slug = slugify(typeof body.slug === "string" && body.slug ? body.slug : title)

    if (!title || !summary || !slug) {
      return NextResponse.json({ error: "title, summary and slug are required." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("technical_insights")
      .insert({
        slug,
        title,
        summary,
        body: content,
        status,
      })
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ insight: data as InsightRow }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as InsightBody
    if (!body.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 })
    }

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const summary = typeof body.summary === "string" ? body.summary.trim() : ""
    const content = typeof body.body === "string" ? body.body.trim() : ""
    const status: InsightStatus = body.status === "published" ? "published" : "draft"
    const slug = slugify(typeof body.slug === "string" && body.slug ? body.slug : title)

    if (!title || !summary || !slug) {
      return NextResponse.json({ error: "title, summary and slug are required." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("technical_insights")
      .update({
        slug,
        title,
        summary,
        body: content,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ insight: data as InsightRow })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
