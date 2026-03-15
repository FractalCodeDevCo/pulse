export const dynamic = "force-dynamic"

import Link from "next/link"

import DataSciencePanel from "../../../components/pulse/DataSciencePanel"
import ContextHeader from "../../../components/pulse/ContextHeader"
import OverviewLiveControls from "../../../components/pulse/OverviewLiveControls"
import { normalizeZoneTargets, ZoneTarget } from "../../../lib/projectSetup"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { FieldType } from "../../../types/fieldType"

type OverviewPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

type ProjectRow = {
  code: string | null
  name: string | null
  sport: string | null
  total_sqft?: number | null
  start_date?: string | null
  crew_name?: string | null
  zone_targets?: unknown
}

type CaptureFactRow = {
  macro_zone: string | null
  micro_zone: string | null
  phase: string | null
  feet_installed: number | null
  glue_buckets: number | null
  total_rolls_used: number | null
  total_seams: number | null
}

type ZoneOverview = {
  zone: string
  plannedSqft: number | null
  plannedRolls: number | null
  plannedAdhesiveUnits: number | null
  plannedSeamFt: number | null
  realFt: number
  realAdhesive: number
  realRolls: number
  realSeams: number
}

type EtaResult = {
  label: string
  date: string | null
}

function normalizeFieldType(value: string | null | undefined): FieldType {
  if (value === "football" || value === "soccer" || value === "beisbol" || value === "softbol") return value
  if (value === "baseball") return "beisbol"
  if (value === "softball") return "softbol"
  return "football"
}

function formatNumber(value: number | null, decimals = 1): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return value.toFixed(decimals)
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return `${value.toFixed(1)}%`
}

function formatDate(value: string | null): string {
  if (!value) return "N/A"
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function getEta(startDate: string | null, progress: number | null): EtaResult {
  if (!startDate) return { label: "No start date", date: null }
  if (progress === null || progress <= 0) return { label: "ETA unavailable", date: null }
  if (progress >= 100) return { label: "Project complete", date: new Date().toISOString() }

  const today = new Date()
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return { label: "Invalid start date", date: null }

  const elapsedMs = Math.max(today.getTime() - start.getTime(), 0)
  const elapsedDays = Math.max(Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)), 1)
  const projectedTotalDays = Math.ceil(elapsedDays / (progress / 100))
  const remainingDays = Math.max(projectedTotalDays - elapsedDays, 0)

  const etaDate = new Date(today)
  etaDate.setDate(today.getDate() + remainingDays)

  return {
    label: remainingDays === 0 ? "Finishes today" : `${remainingDays} days remaining`,
    date: etaDate.toISOString(),
  }
}

function ensureZoneMetrics(map: Map<string, ZoneOverview>, zone: string): ZoneOverview {
  const existing = map.get(zone)
  if (existing) return existing

  const created: ZoneOverview = {
    zone,
    plannedSqft: null,
    plannedRolls: null,
    plannedAdhesiveUnits: null,
    plannedSeamFt: null,
    realFt: 0,
    realAdhesive: 0,
    realRolls: 0,
    realSeams: 0,
  }
  map.set(zone, created)
  return created
}

export default async function ProjectOverviewPage({ searchParams }: OverviewPageProps) {
  const params = await searchParams
  const projectId = params.project ?? null

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Select a project to view the operating summary.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700">
          Go to projects
        </Link>
      </main>
    )
  }

  const supabase = getSupabaseAdminClient()
  const zoneMetricsMap = new Map<string, ZoneOverview>()
  let loadError = ""
  let projectName = projectId
  let fieldType: FieldType = "football"
  let startDate: string | null = null
  let crewName = ""
  let totalSqft: number | null = null
  let zoneTargets: ZoneTarget[] = []

  try {
    const projectRes = await supabase
      .from("projects")
      .select("*")
      .eq("code", projectId)
      .limit(1)
      .maybeSingle()

    if (projectRes.error) throw new Error(projectRes.error.message)

    const project = (projectRes.data ?? null) as ProjectRow | null
    if (project) {
      projectName = project.name?.trim() || projectId
      fieldType = normalizeFieldType(project.sport)
      totalSqft = typeof project.total_sqft === "number" ? project.total_sqft : null
      startDate = typeof project.start_date === "string" && project.start_date ? project.start_date : null
      crewName = typeof project.crew_name === "string" ? project.crew_name : ""
      zoneTargets = normalizeZoneTargets(fieldType, project.zone_targets)
    } else {
      zoneTargets = normalizeZoneTargets(fieldType, [])
    }

    for (const target of zoneTargets) {
      zoneMetricsMap.set(target.zone, {
        zone: target.zone,
        plannedSqft: target.plannedSqft,
        plannedRolls: target.plannedRolls,
        plannedAdhesiveUnits: target.plannedAdhesiveUnits,
        plannedSeamFt: target.plannedSeamFt,
        realFt: 0,
        realAdhesive: 0,
        realRolls: 0,
        realSeams: 0,
      })
    }

    const capturesRes = await supabase
      .from("agent_capture_facts")
      .select("macro_zone,micro_zone,phase,feet_installed,glue_buckets,total_rolls_used,total_seams")
      .eq("project_id", projectId)
      .order("captured_at", { ascending: true })
      .limit(10000)

    if (capturesRes.error) throw new Error(capturesRes.error.message)

    for (const row of (capturesRes.data ?? []) as CaptureFactRow[]) {
      const zone = row.micro_zone ?? row.macro_zone ?? "Sin zona"
      const metric = ensureZoneMetrics(zoneMetricsMap, zone)
      metric.realFt += row.feet_installed ?? 0
      metric.realAdhesive += row.glue_buckets ?? 0
      metric.realRolls += row.total_rolls_used ?? 0
      metric.realSeams += row.total_seams ?? 0
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the project summary."
  }

  const zoneMetrics = [...zoneMetricsMap.values()].sort((a, b) => a.zone.localeCompare(b.zone))
  const plannedSqftTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedSqft ?? 0), 0)
  const plannedRollsTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedRolls ?? 0), 0)
  const plannedAdhesiveTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedAdhesiveUnits ?? 0), 0)
  const plannedSeamTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedSeamFt ?? 0), 0)

  const realFtTotal = zoneMetrics.reduce((sum, item) => sum + item.realFt, 0)
  const realRollsTotal = zoneMetrics.reduce((sum, item) => sum + item.realRolls, 0)
  const realAdhesiveTotal = zoneMetrics.reduce((sum, item) => sum + item.realAdhesive, 0)
  const realSeamTotal = zoneMetrics.reduce((sum, item) => sum + item.realSeams, 0)

  const progressTotal =
    plannedSqftTotal > 0
      ? clampPercent((realFtTotal / plannedSqftTotal) * 100)
      : totalSqft && totalSqft > 0
        ? clampPercent((realFtTotal / totalSqft) * 100)
        : null

  const adhesiveDeviation =
    plannedAdhesiveTotal > 0 ? ((realAdhesiveTotal - plannedAdhesiveTotal) / plannedAdhesiveTotal) * 100 : null

  const eta = getEta(startDate, progressTotal)
  const objectiveFtDone = progressTotal !== null && progressTotal >= 100
  const objectiveRollsDone = plannedRollsTotal > 0 && realRollsTotal >= plannedRollsTotal
  const objectiveAdhesiveDone = adhesiveDeviation !== null && Math.abs(adhesiveDeviation) <= 15
  const objectiveSeamsDone = plannedSeamTotal > 0 ? realSeamTotal <= plannedSeamTotal : true
  const objectivesDone = [objectiveFtDone, objectiveRollsDone, objectiveAdhesiveDone, objectiveSeamsDone].filter(Boolean).length

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <ContextHeader
          title={`${projectName} � Overview`}
          subtitle="Plan versus actual by zone."
          backHref={`/pulse?project=${encodeURIComponent(projectId)}`}
          backLabel="Zones"
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: projectId, href: `/pulse?project=${encodeURIComponent(projectId)}` },
            { label: "Overview" },
          ]}
          projectLabel={projectId}
          statusLabel={progressTotal === null ? "No baseline" : `${progressTotal.toFixed(1)}%`}
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />
        <p className="text-sm text-neutral-400">
          Sport: {fieldType} · Start: {formatDate(startDate)} · Crew: {crewName || "N/A"}
        </p>
        <OverviewLiveControls defaultIntervalSec={45} />

        {loadError ? (
          <section className="rounded-2xl border border-red-500/70 bg-red-500/10 p-4 text-red-300">
            Error loading overview: {loadError}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Overall progress</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPercent(progressTotal)}</p>
            <p className="text-xs text-neutral-400">
              Actual ft {formatNumber(realFtTotal, 1)} / Planned ft {formatNumber(plannedSqftTotal > 0 ? plannedSqftTotal : totalSqft, 1)}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Glue buckets versus plan</p>
            <p className="mt-2 text-3xl font-bold text-cyan-300">
              {formatNumber(realAdhesiveTotal, 1)} / {formatNumber(plannedAdhesiveTotal > 0 ? plannedAdhesiveTotal : null, 1)}
            </p>
            <p className="text-xs text-neutral-400">Adhesive deviation: {formatPercent(adhesiveDeviation)}</p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Rolls used versus plan</p>
            <p className="mt-2 text-3xl font-bold text-blue-300">
              {formatNumber(realRollsTotal, 0)} / {formatNumber(plannedRollsTotal > 0 ? plannedRollsTotal : null, 0)}
            </p>
            <p className="text-xs text-neutral-400">Actual seams: {formatNumber(realSeamTotal, 0)}</p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Estimated finish</p>
            <p className="mt-2 text-2xl font-bold text-violet-300">{eta.label}</p>
            <p className="text-xs text-neutral-400">Estimated date: {formatDate(eta.date)}</p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Base setup</p>
            <p className="mt-2 text-3xl font-bold text-neutral-100">{zoneMetrics.length} zones</p>
            <p className="text-xs text-neutral-400">Configured sqft: {formatNumber(totalSqft, 1)}</p>
          </article>
        </section>

        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Goal progress</h2>
              <p className="text-sm text-neutral-400">Measures real operating execution against plan.</p>
            </div>
            <p className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              {objectivesDone}/4 goals on target
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className={`rounded-xl border p-3 ${objectiveFtDone ? "border-emerald-500/60 bg-emerald-500/10" : "border-amber-500/60 bg-amber-500/10"}`}>
              <p className="text-xs text-neutral-300">Installed feet goal</p>
              <p className="mt-1 text-lg font-semibold">{formatPercent(progressTotal)}</p>
            </article>
            <article className={`rounded-xl border p-3 ${objectiveRollsDone ? "border-emerald-500/60 bg-emerald-500/10" : "border-amber-500/60 bg-amber-500/10"}`}>
              <p className="text-xs text-neutral-300">Roll goal</p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(realRollsTotal, 0)} / {formatNumber(plannedRollsTotal > 0 ? plannedRollsTotal : null, 0)}</p>
            </article>
            <article className={`rounded-xl border p-3 ${objectiveAdhesiveDone ? "border-emerald-500/60 bg-emerald-500/10" : "border-amber-500/60 bg-amber-500/10"}`}>
              <p className="text-xs text-neutral-300">Adhesive goal</p>
              <p className="mt-1 text-lg font-semibold">{formatPercent(adhesiveDeviation)}</p>
            </article>
            <article className={`rounded-xl border p-3 ${objectiveSeamsDone ? "border-emerald-500/60 bg-emerald-500/10" : "border-amber-500/60 bg-amber-500/10"}`}>
              <p className="text-xs text-neutral-300">Seam goal</p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(realSeamTotal, 0)} / {formatNumber(plannedSeamTotal > 0 ? plannedSeamTotal : null, 0)}</p>
            </article>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`/api/reports/project-summary?project=${encodeURIComponent(projectId)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-xl border border-blue-500 px-4 py-3 text-center font-semibold text-blue-300 hover:bg-blue-500/10"
            >
              Generate executive report
            </a>
            <p className="text-xs text-neutral-400 sm:self-center">Printable report based on unified project captures.</p>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Zone progress</h2>
          {zoneMetrics.length === 0 ? (
            <p className="text-sm text-neutral-400">No zones available for this project.</p>
          ) : (
            <div className="space-y-3">
              {zoneMetrics.map((zone) => {
                const zoneProgress = zone.plannedSqft && zone.plannedSqft > 0 ? clampPercent((zone.realFt / zone.plannedSqft) * 100) : null
                return (
                  <article key={zone.zone} className="rounded-xl border border-neutral-700 bg-neutral-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{zone.zone}</p>
                      <p className="text-sm text-emerald-300">{formatPercent(zoneProgress)}</p>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${zoneProgress === null ? 0 : zoneProgress}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
                      <p>Ft: {formatNumber(zone.realFt, 1)} / {formatNumber(zone.plannedSqft, 1)}</p>
                      <p>Buckets: {formatNumber(zone.realAdhesive, 1)} / {formatNumber(zone.plannedAdhesiveUnits, 1)}</p>
                      <p>Rolls: {formatNumber(zone.realRolls, 0)} / {formatNumber(zone.plannedRolls, 0)}</p>
                      <p>Seams: {formatNumber(zone.realSeams, 0)} / {formatNumber(zone.plannedSeamFt, 0)}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <DataSciencePanel projectId={projectId} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/pulse?project=${encodeURIComponent(projectId)}`}
            className="w-full rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
          >
            Back to zones
          </Link>
          <Link
            href={`/pulse/history?project=${encodeURIComponent(projectId)}`}
            className="w-full rounded-xl border border-amber-500 px-4 py-3 text-center font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            View history
          </Link>
        </div>
      </section>
    </main>
  )
}




