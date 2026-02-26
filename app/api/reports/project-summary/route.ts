import { NextResponse } from "next/server"

import { normalizeZoneTargets } from "../../../../lib/projectSetup"
import { getSupabaseAdminClient } from "../../../../lib/supabase/server"
import { FieldType } from "../../../../types/fieldType"

export const runtime = "nodejs"

type ProjectRow = {
  code: string | null
  name: string | null
  sport: string | null
  total_sqft?: number | null
  start_date?: string | null
  crew_name?: string | null
  zone_targets?: unknown
}

type ZoneTotals = {
  realFt: number
  realAdhesive: number
  realRolls: number
  realSeams: number
}

type SplitTotals = {
  captures: number
  realFt: number
  realAdhesive: number
  realRolls: number
  realSeams: number
  materialExpected: number
  materialUsed: number
}

function normalizeFieldType(value: string | null | undefined): FieldType {
  if (value === "football" || value === "soccer" || value === "beisbol" || value === "softbol") return value
  if (value === "baseball") return "beisbol"
  if (value === "softball") return "softbol"
  return "football"
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
  if (typeof value !== "string") return ""
  return value.trim()
}

function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return `${value.toFixed(1)}%`
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function objectivePill(label: string, done: boolean, value: string): string {
  const tone = done ? "ok" : "warn"
  return `<div class="pill ${tone}"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`
}

function createSplitTotals(): SplitTotals {
  return {
    captures: 0,
    realFt: 0,
    realAdhesive: 0,
    realRolls: 0,
    realSeams: 0,
    materialExpected: 0,
    materialUsed: 0,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = (searchParams.get("project") ?? "").trim()
    if (!projectId) {
      return NextResponse.json({ error: "project is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("code,name,sport,total_sqft,start_date,crew_name,zone_targets")
      .eq("code", projectId)
      .limit(1)

    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })

    const project = (projectRows?.[0] ?? null) as ProjectRow | null
    const projectName = project?.name?.trim() || projectId
    const fieldType = normalizeFieldType(project?.sport)
    const totalSqft = toNumber(project?.total_sqft)
    const zoneTargets = normalizeZoneTargets(fieldType, project?.zone_targets)

    const zoneMap = new Map<string, ZoneTotals>()
    for (const target of zoneTargets) {
      zoneMap.set(target.zone, { realFt: 0, realAdhesive: 0, realRolls: 0, realSeams: 0 })
    }

    const [fieldRes, rollRes, materialRes] = await Promise.all([
      supabase.from("field_records").select("project_zone_id,macro_zone,micro_zone,payload").eq("project_id", projectId).eq("module", "pegada").limit(5000),
      supabase.from("roll_installation").select("project_zone_id,macro_zone,zone,total_rolls_used,total_seams").eq("project_id", projectId).limit(5000),
      supabase.from("material_records").select("project_zone_id,bolsas_esperadas,bolsas_utilizadas").eq("project_id", projectId).limit(5000),
    ])

    if (fieldRes.error && fieldRes.error.code !== "42P01") return NextResponse.json({ error: fieldRes.error.message }, { status: 500 })
    if (rollRes.error && rollRes.error.code !== "42P01") return NextResponse.json({ error: rollRes.error.message }, { status: 500 })
    if (materialRes.error && materialRes.error.code !== "42P01") return NextResponse.json({ error: materialRes.error.message }, { status: 500 })

    const zonified = createSplitTotals()
    const legacy = createSplitTotals()

    for (const row of (fieldRes.data ?? []) as Array<Record<string, unknown>>) {
      const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {}
      const metadata =
        payload.metadata && typeof payload.metadata === "object"
          ? (payload.metadata as Record<string, unknown>)
          : payload

      const bucket = row.project_zone_id ? zonified : legacy
      const zone = toText(row.macro_zone) || toText(metadata.macro_zone) || toText(metadata.macroZone) || "Sin zona"
      const ft = toNumber(metadata.ftTotales ?? metadata.ft_totales ?? metadata.ft)
      const adhesive = toNumber(metadata.botesUsados ?? metadata.botes_usados ?? metadata.botes)
      bucket.captures += 1
      bucket.realFt += ft
      bucket.realAdhesive += adhesive

      if (row.project_zone_id) {
        if (!zoneMap.has(zone)) zoneMap.set(zone, { realFt: 0, realAdhesive: 0, realRolls: 0, realSeams: 0 })
        const current = zoneMap.get(zone)!
        current.realFt += ft
        current.realAdhesive += adhesive
      }
    }

    for (const row of (rollRes.data ?? []) as Array<Record<string, unknown>>) {
      const bucket = row.project_zone_id ? zonified : legacy
      const rolls = toNumber(row.total_rolls_used)
      const seams = toNumber(row.total_seams)
      bucket.captures += 1
      bucket.realRolls += rolls
      bucket.realSeams += seams

      if (row.project_zone_id) {
        const zone = toText(row.macro_zone) || toText(row.zone) || "Sin zona"
        if (!zoneMap.has(zone)) zoneMap.set(zone, { realFt: 0, realAdhesive: 0, realRolls: 0, realSeams: 0 })
        const current = zoneMap.get(zone)!
        current.realRolls += rolls
        current.realSeams += seams
      }
    }

    for (const row of (materialRes.data ?? []) as Array<Record<string, unknown>>) {
      const bucket = row.project_zone_id ? zonified : legacy
      const expected = toNumber(row.bolsas_esperadas)
      const used = toNumber(row.bolsas_utilizadas)
      bucket.captures += 1
      bucket.materialExpected += expected
      bucket.materialUsed += used
    }

    const plannedSqftTotal = zoneTargets.reduce((sum, item) => sum + (item.plannedSqft ?? 0), 0)
    const plannedRollsTotal = zoneTargets.reduce((sum, item) => sum + (item.plannedRolls ?? 0), 0)
    const plannedAdhesiveTotal = zoneTargets.reduce((sum, item) => sum + (item.plannedAdhesiveUnits ?? 0), 0)
    const plannedSeamTotal = zoneTargets.reduce((sum, item) => sum + (item.plannedSeamFt ?? 0), 0)

    const zones = [...zoneMap.entries()].map(([zone, totals]) => ({ zone, ...totals })).sort((a, b) => a.zone.localeCompare(b.zone))
    const realFtTotal = zones.reduce((sum, item) => sum + item.realFt, 0)
    const realRollsTotal = zones.reduce((sum, item) => sum + item.realRolls, 0)
    const realAdhesiveTotal = zones.reduce((sum, item) => sum + item.realAdhesive, 0)
    const realSeamTotal = zones.reduce((sum, item) => sum + item.realSeams, 0)

    const progressFt =
      plannedSqftTotal > 0 ? Math.max(0, Math.min(100, (realFtTotal / plannedSqftTotal) * 100)) : totalSqft > 0 ? Math.max(0, Math.min(100, (realFtTotal / totalSqft) * 100)) : null
    const adhesiveDeviation = plannedAdhesiveTotal > 0 ? ((realAdhesiveTotal - plannedAdhesiveTotal) / plannedAdhesiveTotal) * 100 : null
    const materialDeviation =
      zonified.materialExpected > 0 ? ((zonified.materialUsed - zonified.materialExpected) / zonified.materialExpected) * 100 : null
    const legacyMaterialDeviation =
      legacy.materialExpected > 0 ? ((legacy.materialUsed - legacy.materialExpected) / legacy.materialExpected) * 100 : null

    const objFtDone = progressFt !== null && progressFt >= 100
    const objRollDone = plannedRollsTotal > 0 && realRollsTotal >= plannedRollsTotal
    const objAdhesiveDone = adhesiveDeviation !== null && Math.abs(adhesiveDeviation) <= 15
    const objMaterialDone = materialDeviation !== null && Math.abs(materialDeviation) <= 12
    const objectivesDone = [objFtDone, objRollDone, objAdhesiveDone, objMaterialDone].filter(Boolean).length

    const tableRows = zones
      .map((item) => {
        const target = zoneTargets.find((targetItem) => targetItem.zone === item.zone)
        const plannedFt = target?.plannedSqft ?? 0
        const plannedRolls = target?.plannedRolls ?? 0
        const plannedAdhesive = target?.plannedAdhesiveUnits ?? 0
        return `<tr>
          <td>${escapeHtml(item.zone)}</td>
          <td>${formatNumber(item.realFt, 1)} / ${formatNumber(plannedFt, 1)}</td>
          <td>${formatNumber(item.realAdhesive, 1)} / ${formatNumber(plannedAdhesive, 1)}</td>
          <td>${formatNumber(item.realRolls, 0)} / ${formatNumber(plannedRolls, 0)}</td>
          <td>${formatNumber(item.realSeams, 0)}</td>
        </tr>`
      })
      .join("")

    const generatedAt = new Date().toLocaleString("es-MX")
    const title = `FractalBuild Report · ${projectName}`

    const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 24px; color: #0b1220; }
      h1,h2,h3 { margin: 0 0 8px 0; }
      .meta { color: #4b5563; margin-bottom: 16px; }
      .box { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
      .pill { display: inline-block; margin: 4px 8px 4px 0; padding: 8px 10px; border-radius: 999px; border: 1px solid #d1d5db; font-size: 13px; }
      .pill.ok { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
      .pill.warn { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 13px; }
      th { background: #f8fafc; }
      .small { font-size: 12px; color: #6b7280; }
      @media print { .noprint { display: none; } body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>fractalbuild.com · Reporte Ejecutivo</h1>
      <p class="meta">${escapeHtml(projectName)} · ${escapeHtml(projectId)} · Generado: ${escapeHtml(generatedAt)}</p>
      <p class="meta">Deporte: ${escapeHtml(fieldType)} · Inicio: ${escapeHtml(project?.start_date ?? "N/A")} · Crew: ${escapeHtml(project?.crew_name ?? "N/A")}</p>
    </div>
    <div class="box">
      <h2>Progreso por Objetivos</h2>
      <p class="meta">${objectivesDone}/4 objetivos en rango operativo.</p>
      ${objectivePill("Ft ejecutados", objFtDone, formatPercent(progressFt))}
      ${objectivePill("Rollos ejecutados", objRollDone, `${formatNumber(realRollsTotal, 0)} / ${formatNumber(plannedRollsTotal, 0)}`)}
      ${objectivePill("Control de adhesivo", objAdhesiveDone, formatPercent(adhesiveDeviation))}
      ${objectivePill("Control de material", objMaterialDone, formatPercent(materialDeviation))}
    </div>
    <div class="box">
      <h2>Resumen General</h2>
      <p class="small">Ft: ${formatNumber(realFtTotal, 1)} / ${formatNumber(plannedSqftTotal > 0 ? plannedSqftTotal : totalSqft, 1)} · Rollos: ${formatNumber(realRollsTotal, 0)} / ${formatNumber(plannedRollsTotal, 0)} · Botes: ${formatNumber(realAdhesiveTotal, 1)} / ${formatNumber(plannedAdhesiveTotal, 1)} · Costuras: ${formatNumber(realSeamTotal, 0)} / ${formatNumber(plannedSeamTotal, 0)}</p>
    </div>
    <div class="box">
      <h2>Métricas Zonificadas vs Legacy</h2>
      <p class="small"><strong>Zonificadas</strong> · Capturas: ${zonified.captures} · Ft: ${formatNumber(zonified.realFt, 1)} · Botes: ${formatNumber(zonified.realAdhesive, 1)} · Rollos: ${formatNumber(zonified.realRolls, 0)} · Material dev: ${formatPercent(materialDeviation)}</p>
      <p class="small"><strong>Legacy</strong> · Capturas: ${legacy.captures} · Ft: ${formatNumber(legacy.realFt, 1)} · Botes: ${formatNumber(legacy.realAdhesive, 1)} · Rollos: ${formatNumber(legacy.realRolls, 0)} · Material dev: ${formatPercent(legacyMaterialDeviation)}</p>
    </div>
    <div class="box">
      <h2>Detalle por Zona</h2>
      <table>
        <thead>
          <tr><th>Zona</th><th>Ft Real / Plan</th><th>Botes Real / Plan</th><th>Rollos Real / Plan</th><th>Costuras</th></tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="5">Sin datos de captura todavía.</td></tr>'}
        </tbody>
      </table>
    </div>
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
