export const dynamic = "force-dynamic"

import Link from "next/link"

import DataSciencePanel from "../../../components/pulse/DataSciencePanel"
import ContextHeader from "../../../components/pulse/ContextHeader"
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

type PegadaRow = {
  macro_zone: string | null
  micro_zone: string | null
  payload: unknown
}

type RollInstallationRow = {
  macro_zone: string | null
  zone: string | null
  total_rolls_used: number | null
  total_seams: number | null
}

type MaterialRow = {
  bolsas_esperadas: number | null
  bolsas_utilizadas: number | null
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

type TableResponse<T> = {
  data: T[]
  relationMissing: boolean
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isMissingRelationError(error: unknown): boolean {
  if (!isObject(error)) return false
  return error.code === "42P01"
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readFirstNumber(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const parsed = toNumber(source[key])
    if (parsed !== null) return parsed
  }
  return 0
}

function readFirstText(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
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
  if (!startDate) return { label: "Sin fecha inicio", date: null }
  if (progress === null || progress <= 0) return { label: "ETA no disponible", date: null }
  if (progress >= 100) return { label: "Proyecto completado", date: new Date().toISOString() }

  const today = new Date()
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return { label: "Fecha inicio inválida", date: null }

  const elapsedMs = Math.max(today.getTime() - start.getTime(), 0)
  const elapsedDays = Math.max(Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)), 1)
  const projectedTotalDays = Math.ceil(elapsedDays / (progress / 100))
  const remainingDays = Math.max(projectedTotalDays - elapsedDays, 0)

  const etaDate = new Date(today)
  etaDate.setDate(today.getDate() + remainingDays)

  return {
    label: remainingDays === 0 ? "Cierre hoy" : `${remainingDays} días restantes`,
    date: etaDate.toISOString(),
  }
}

async function selectTableRows<T>(params: {
  table: string
  columns: string
  projectId: string
  module?: string
}): Promise<TableResponse<T>> {
  const supabase = getSupabaseAdminClient()
  let query = supabase.from(params.table).select(params.columns).eq("project_id", params.projectId)
  if (params.module) query = query.eq("module", params.module)

  const { data, error } = await query.limit(2000)
  if (error) {
    if (isMissingRelationError(error)) {
      return { data: [], relationMissing: true }
    }
    throw new Error(error.message ?? `No se pudo leer ${params.table}`)
  }

  return {
    data: (data ?? []) as T[],
    relationMissing: false,
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
        <p className="text-center text-neutral-300">Selecciona un proyecto para ver el overview.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700">
          Ir a proyectos
        </Link>
      </main>
    )
  }

  let loadError = ""
  let projectName = projectId
  let fieldType: FieldType = "football"
  let startDate: string | null = null
  let crewName = ""
  let totalSqft: number | null = null
  let zoneTargets: ZoneTarget[] = []
  let relationWarnings: string[] = []

  const zoneMetricsMap = new Map<string, ZoneOverview>()
  let materialExpected = 0
  let materialUsed = 0

  try {
    const supabase = getSupabaseAdminClient()
    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("code", projectId)
      .limit(1)

    if (projectError) {
      if (!isMissingRelationError(projectError)) {
        throw new Error(projectError.message ?? "No se pudo leer setup del proyecto.")
      }
      relationWarnings.push("tabla projects no encontrada")
    }

    const project = (projectRows?.[0] ?? null) as ProjectRow | null
    if (project) {
      projectName = project.name?.trim() || projectId
      fieldType = normalizeFieldType(project.sport)
      totalSqft = toNumber(project.total_sqft)
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

    const [pegadaRes, rollRes, materialRes] = await Promise.all([
      selectTableRows<PegadaRow>({
        table: "field_records",
        columns: "macro_zone, micro_zone, payload",
        projectId,
        module: "pegada",
      }),
      selectTableRows<RollInstallationRow>({
        table: "roll_installation",
        columns: "macro_zone, zone, total_rolls_used, total_seams",
        projectId,
      }),
      selectTableRows<MaterialRow>({
        table: "material_records",
        columns: "bolsas_esperadas, bolsas_utilizadas",
        projectId,
      }),
    ])

    if (pegadaRes.relationMissing) relationWarnings.push("tabla field_records no encontrada")
    if (rollRes.relationMissing) relationWarnings.push("tabla roll_installation no encontrada")
    if (materialRes.relationMissing) relationWarnings.push("tabla material_records no encontrada")

    for (const row of pegadaRes.data) {
      const payload = isObject(row.payload) ? row.payload : {}
      const metadata = isObject(payload.metadata) ? payload.metadata : payload
      const zone =
        row.macro_zone ??
        readFirstText(metadata, ["macro_zone", "macroZone", "zone"]) ??
        row.micro_zone ??
        readFirstText(metadata, ["micro_zone", "microZone"]) ??
        "Sin zona"

      const metric = ensureZoneMetrics(zoneMetricsMap, zone)
      metric.realFt += readFirstNumber(metadata, ["ftTotales", "ft_totales", "ft", "feet"])
      metric.realAdhesive += readFirstNumber(metadata, ["botesUsados", "botes_usados", "botes"])
    }

    for (const row of rollRes.data) {
      const zone = row.macro_zone ?? row.zone ?? "Sin zona"
      const metric = ensureZoneMetrics(zoneMetricsMap, zone)
      metric.realRolls += Math.max(0, toNumber(row.total_rolls_used) ?? 0)
      metric.realSeams += Math.max(0, toNumber(row.total_seams) ?? 0)
    }

    for (const row of materialRes.data) {
      materialExpected += Math.max(0, toNumber(row.bolsas_esperadas) ?? 0)
      materialUsed += Math.max(0, toNumber(row.bolsas_utilizadas) ?? 0)
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "No se pudo cargar overview del proyecto."
  }

  const zoneMetrics = [...zoneMetricsMap.values()].sort((a, b) => a.zone.localeCompare(b.zone))
  const plannedSqftTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedSqft ?? 0), 0)
  const plannedRollsTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedRolls ?? 0), 0)
  const plannedAdhesiveTotal = zoneMetrics.reduce((sum, item) => sum + (item.plannedAdhesiveUnits ?? 0), 0)

  const realFtTotal = zoneMetrics.reduce((sum, item) => sum + item.realFt, 0)
  const realRollsTotal = zoneMetrics.reduce((sum, item) => sum + item.realRolls, 0)
  const realAdhesiveTotal = zoneMetrics.reduce((sum, item) => sum + item.realAdhesive, 0)

  const progressTotal =
    plannedSqftTotal > 0
      ? clampPercent((realFtTotal / plannedSqftTotal) * 100)
      : totalSqft && totalSqft > 0
        ? clampPercent((realFtTotal / totalSqft) * 100)
        : null

  const adhesiveDeviation =
    plannedAdhesiveTotal > 0 ? ((realAdhesiveTotal - plannedAdhesiveTotal) / plannedAdhesiveTotal) * 100 : null

  const materialDeviation = materialExpected > 0 ? ((materialUsed - materialExpected) / materialExpected) * 100 : null
  const eta = getEta(startDate, progressTotal)

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <ContextHeader
          title={`${projectName} · Overview`}
          subtitle="Control operativo plan vs real por zona."
          backHref={`/pulse?project=${encodeURIComponent(projectId)}`}
          backLabel="Zonas"
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: projectId, href: `/pulse?project=${encodeURIComponent(projectId)}` },
            { label: "Overview" },
          ]}
          projectLabel={projectId}
          statusLabel={progressTotal === null ? "Sin baseline" : `${progressTotal.toFixed(1)}%`}
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />
        <p className="text-sm text-neutral-400">
          Deporte: {fieldType} · Inicio: {formatDate(startDate)} · Crew: {crewName || "N/A"}
        </p>

        {loadError ? (
          <section className="rounded-2xl border border-red-500/70 bg-red-500/10 p-4 text-red-300">
            Error cargando overview: {loadError}
          </section>
        ) : null}

        {relationWarnings.length > 0 ? (
          <section className="rounded-2xl border border-amber-500/70 bg-amber-500/10 p-4 text-amber-200">
            Algunas tablas aún no existen en Supabase: {relationWarnings.join(", ")}.
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Progreso Total</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{formatPercent(progressTotal)}</p>
            <p className="text-xs text-neutral-400">
              Ft reales {formatNumber(realFtTotal, 1)} / Ft plan {formatNumber(plannedSqftTotal > 0 ? plannedSqftTotal : totalSqft, 1)}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Botes Usados vs Plan</p>
            <p className="mt-2 text-3xl font-bold text-cyan-300">
              {formatNumber(realAdhesiveTotal, 1)} / {formatNumber(plannedAdhesiveTotal > 0 ? plannedAdhesiveTotal : null, 1)}
            </p>
            <p className="text-xs text-neutral-400">Desviación adhesivo: {formatPercent(adhesiveDeviation)}</p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Rollos Usados vs Plan</p>
            <p className="mt-2 text-3xl font-bold text-blue-300">
              {formatNumber(realRollsTotal, 0)} / {formatNumber(plannedRollsTotal > 0 ? plannedRollsTotal : null, 0)}
            </p>
            <p className="text-xs text-neutral-400">Plan de setup por zona</p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Desviación Material</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{formatPercent(materialDeviation)}</p>
            <p className="text-xs text-neutral-400">
              Bolsas usadas {formatNumber(materialUsed, 1)} / esperadas {formatNumber(materialExpected > 0 ? materialExpected : null, 1)}
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">ETA Estimado</p>
            <p className="mt-2 text-2xl font-bold text-violet-300">{eta.label}</p>
            <p className="text-xs text-neutral-400">Fecha estimada: {formatDate(eta.date)}</p>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Setup Base</p>
            <p className="mt-2 text-3xl font-bold text-neutral-100">{zoneMetrics.length} zonas</p>
            <p className="text-xs text-neutral-400">Total sqft setup: {formatNumber(totalSqft, 1)}</p>
          </article>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Progreso por Zona</h2>
          {zoneMetrics.length === 0 ? (
            <p className="text-sm text-neutral-400">No hay zonas para mostrar en este proyecto.</p>
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
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${zoneProgress === null ? 0 : zoneProgress}%` }}
                      />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
                      <p>Ft: {formatNumber(zone.realFt, 1)} / {formatNumber(zone.plannedSqft, 1)}</p>
                      <p>Botes: {formatNumber(zone.realAdhesive, 1)} / {formatNumber(zone.plannedAdhesiveUnits, 1)}</p>
                      <p>Rollos: {formatNumber(zone.realRolls, 0)} / {formatNumber(zone.plannedRolls, 0)}</p>
                      <p>Costuras: {formatNumber(zone.realSeams, 0)} / {formatNumber(zone.plannedSeamFt, 0)}</p>
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
            Volver a zonas
          </Link>
          <Link
            href={`/pulse/history?project=${encodeURIComponent(projectId)}`}
            className="w-full rounded-xl border border-amber-500 px-4 py-3 text-center font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            Ver historial
          </Link>
        </div>
      </section>
    </main>
  )
}
