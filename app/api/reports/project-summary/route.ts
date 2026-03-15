import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../../lib/supabase/server"

export const runtime = "nodejs"

type ProjectRow = {
  code: string | null
  name: string | null
  sport: string | null
  crew_name?: string | null
}

type ZoneSummary = {
  zone: string
  totalFeetInstalled: number
  totalRollsUsed: number
  totalGlueBuckets: number
  totalSeams: number
  capturesCount: number
  latestTimestamp: string | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isMissingRelation(error: unknown): boolean {
  if (!isObject(error)) return false
  return error.code === "42P01"
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function createZoneSummary(zone: string): ZoneSummary {
  return {
    zone,
    totalFeetInstalled: 0,
    totalRollsUsed: 0,
    totalGlueBuckets: 0,
    totalSeams: 0,
    capturesCount: 0,
    latestTimestamp: null,
  }
}

function pickMetric(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = toNumber(source[key])
    if (value !== 0) return value
  }
  return 0
}

function resolveZone(row: Record<string, unknown>, metadata: Record<string, unknown>): string {
  return (
    toText(row.zone) ||
    toText(row.micro_zone) ||
    toText(row.macro_zone) ||
    toText(metadata.zone) ||
    toText(metadata.microZone) ||
    toText(metadata.micro_zone) ||
    toText(metadata.macroZone) ||
    toText(metadata.macro_zone) ||
    "Sin zona"
  )
}

function addToZoneSummary(summary: ZoneSummary, params: {
  feetInstalled: number
  rollsUsed: number
  glueBuckets: number
  seams: number
  timestamp: string | null
}): void {
  summary.totalFeetInstalled += params.feetInstalled
  summary.totalRollsUsed += params.rollsUsed
  summary.totalGlueBuckets += params.glueBuckets
  summary.totalSeams += params.seams
  summary.capturesCount += 1
  if (params.timestamp && (!summary.latestTimestamp || params.timestamp > summary.latestTimestamp)) {
    summary.latestTimestamp = params.timestamp
  }
}

async function buildZoneSummaryFromCaptures(projectId: string): Promise<ZoneSummary[]> {
  const supabase = getSupabaseAdminClient()
  const capturesRes = await supabase
    .from("captures")
    .select("*")
    .eq("project_id", projectId)
    .order("timestamp", { ascending: true })
    .limit(10000)

  if (capturesRes.error) {
    if (isMissingRelation(capturesRes.error)) return []
    throw new Error(capturesRes.error.message)
  }

  const zoneMap = new Map<string, ZoneSummary>()
  for (const row of (capturesRes.data ?? []) as Record<string, unknown>[]) {
    const metadata = isObject(row.metadata) ? row.metadata : {}
    const zone = resolveZone(row, metadata)
    const summary = zoneMap.get(zone) ?? createZoneSummary(zone)

    const feetInstalled = pickMetric(row, ["feet_installed"]) || pickMetric(metadata, ["feet_installed", "feetInstalled", "ftTotales", "ft_totales", "ft"])
    const rollsUsed = pickMetric(row, ["rolls_used"]) || pickMetric(metadata, ["rolls_used", "rollsUsed", "totalRollsUsed", "total_rolls_used", "totalRolls"])
    const glueBuckets = pickMetric(row, ["glue_buckets"]) || pickMetric(metadata, ["glue_buckets", "glueBuckets", "botesUsados", "botes_usados", "botes"])
    const seams = pickMetric(row, ["seams"]) || pickMetric(metadata, ["seams", "totalSeams", "total_seams"])

    addToZoneSummary(summary, {
      feetInstalled,
      rollsUsed,
      glueBuckets,
      seams,
      timestamp: toText(row.timestamp) || null,
    })
    zoneMap.set(zone, summary)
  }

  return [...zoneMap.values()].sort((a, b) => a.zone.localeCompare(b.zone))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = (searchParams.get("project") ?? "").trim()
    if (!projectId) {
      return NextResponse.json({ error: "project is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const projectRes = await supabase
      .from("projects")
      .select("code,name,sport,crew_name")
      .eq("code", projectId)
      .limit(1)
      .maybeSingle()

    if (projectRes.error && !isMissingRelation(projectRes.error)) {
      return NextResponse.json({ error: projectRes.error.message }, { status: 500 })
    }

    const project = (projectRes.data ?? null) as ProjectRow | null
    const zones = await buildZoneSummaryFromCaptures(projectId)
    const source = "captures"

    const totals = zones.reduce(
      (acc, zone) => ({
        totalFeetInstalled: acc.totalFeetInstalled + zone.totalFeetInstalled,
        totalRollsUsed: acc.totalRollsUsed + zone.totalRollsUsed,
        totalGlueBuckets: acc.totalGlueBuckets + zone.totalGlueBuckets,
        totalSeams: acc.totalSeams + zone.totalSeams,
        capturesCount: acc.capturesCount + zone.capturesCount,
      }),
      {
        totalFeetInstalled: 0,
        totalRollsUsed: 0,
        totalGlueBuckets: 0,
        totalSeams: 0,
        capturesCount: 0,
      },
    )

    const rowsHtml = zones
      .map(
        (zone) => `<tr>
          <td>${escapeHtml(zone.zone)}</td>
          <td>${formatNumber(zone.totalFeetInstalled, 1)}</td>
          <td>${formatNumber(zone.totalRollsUsed, 0)}</td>
          <td>${formatNumber(zone.totalGlueBuckets, 1)}</td>
          <td>${formatNumber(zone.totalSeams, 0)}</td>
          <td>${zone.latestTimestamp ? escapeHtml(new Date(zone.latestTimestamp).toLocaleString("es-MX")) : "N/A"}</td>
        </tr>`,
      )
      .join("")

    const generatedAt = new Date().toLocaleString("es-MX")
    const projectName = project?.name?.trim() || projectId

    const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(projectName)} · Zone Report</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
      .panel { background: white; border: 1px solid #dbe4ee; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
      h1, h2 { margin: 0 0 10px 0; }
      .meta { color: #475569; font-size: 14px; }
      .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
      .stat { border: 1px solid #dbe4ee; border-radius: 12px; padding: 12px; background: #f8fafc; }
      .stat strong { display: block; font-size: 22px; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 14px; }
      th { background: #eff6ff; }
      .note { font-size: 12px; color: #64748b; }
      @media print { body { margin: 10mm; background: white; } .noprint { display: none; } }
    </style>
  </head>
  <body>
    <section class="panel">
      <h1>Reporte por Zona</h1>
      <p class="meta">${escapeHtml(projectName)} · ${escapeHtml(projectId)} · Generado ${escapeHtml(generatedAt)}</p>
      <p class="meta">Deporte: ${escapeHtml(project?.sport ?? "N/A")} · Crew: ${escapeHtml(project?.crew_name ?? "N/A")} · Fuente: ${escapeHtml(source)}</p>
      <div class="stats">
        <div class="stat"><span>Total feet installed</span><strong>${formatNumber(totals.totalFeetInstalled, 1)}</strong></div>
        <div class="stat"><span>Total rolls used</span><strong>${formatNumber(totals.totalRollsUsed, 0)}</strong></div>
        <div class="stat"><span>Total glue buckets</span><strong>${formatNumber(totals.totalGlueBuckets, 1)}</strong></div>
        <div class="stat"><span>Total seams</span><strong>${formatNumber(totals.totalSeams, 0)}</strong></div>
      </div>
      <p class="note">Capturas agregadas: ${totals.capturesCount}</p>
    </section>

    <section class="panel">
      <h2>Resumen limpio por zona</h2>
      <table>
        <thead>
          <tr>
            <th>Zona</th>
            <th>Feet installed</th>
            <th>Rolls used</th>
            <th>Glue buckets</th>
            <th>Seams</th>
            <th>Ultimo evento</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6">Sin capturas para este proyecto.</td></tr>'}
        </tbody>
      </table>
    </section>

    <button class="noprint" onclick="window.print()">Imprimir / Guardar PDF</button>
  </body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


