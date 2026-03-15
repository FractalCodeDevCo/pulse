export const dynamic = "force-dynamic"

import Link from "next/link"

import { getSupabaseAdminClient } from "../../lib/supabase/server"

type DashboardPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

type ZoneDashboardMetrics = {
  zone: string
  realFt: number
  realBotes: number
  plannedFt: number
  plannedBotes: number
}

type DatabaseProjectRow = {
  project_id: string | null
  created_at: string | null
}

type PegadaRow = {
  macro_zone: string | null
  micro_zone: string | null
  payload: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
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

function parsePegadaPayload(row: PegadaRow): ZoneDashboardMetrics {
  const payload = isObject(row.payload) ? row.payload : {}
  const metadata = isObject(payload.metadata) ? payload.metadata : payload

  const zone =
    (typeof row.macro_zone === "string" && row.macro_zone) ||
    (typeof metadata.macro_zone === "string" && metadata.macro_zone) ||
    (typeof row.micro_zone === "string" && row.micro_zone) ||
    (typeof metadata.micro_zone === "string" && metadata.micro_zone) ||
    "Sin zona"

  const realFt = readFirstNumber(metadata, ["ftTotales", "ft_totales", "real_ft", "ft", "feet"])
  const realBotes = readFirstNumber(metadata, ["botesUsados", "botes_usados", "botes", "real_botes"])
  const plannedFt = readFirstNumber(metadata, ["planned_ft", "plannedFt", "ftPlaneados", "ft_planeados"])
  const plannedBotes = readFirstNumber(metadata, ["planned_botes", "plannedBotes", "botesPlaneados", "botes_planeados"])

  return { zone, realFt, realBotes, plannedFt, plannedBotes }
}

function pct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return `${value.toFixed(1)}%`
}

function num(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return value.toFixed(decimals)
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams

  let projectRows: DatabaseProjectRow[] = []
  let metricsByZone: ZoneDashboardMetrics[] = []
  let loadError = ""

  try {
    const supabase = getSupabaseAdminClient()

    const [fieldProjects, materialProjects, rollProjects] = await Promise.all([
      supabase.from("field_records").select("project_id, created_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("material_records").select("project_id, created_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("roll_installation").select("project_id, created_at").order("created_at", { ascending: false }).limit(1000),
    ])

    const projectLatestMap = new Map<string, string>()
    const sourceRows = [fieldProjects.data ?? [], materialProjects.data ?? [], rollProjects.data ?? []] as DatabaseProjectRow[][]
    for (const rows of sourceRows) {
      for (const row of rows) {
        if (!row.project_id) continue
        if (!projectLatestMap.has(row.project_id)) {
          projectLatestMap.set(row.project_id, row.created_at ?? "")
        }
      }
    }

    projectRows = [...projectLatestMap.entries()]
      .map(([project_id, created_at]) => ({ project_id, created_at }))
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))

    const selectedProject = params.project ?? projectRows[0]?.project_id ?? null

    if (selectedProject) {
      const { data: pegadaRows, error: pegadaError } = await supabase
        .from("field_records")
        .select("macro_zone, micro_zone, payload")
        .eq("project_id", selectedProject)
        .eq("module", "pegada")
        .order("created_at", { ascending: false })

      if (pegadaError) {
        loadError = pegadaError.message
      } else {
        const zoneMap = new Map<string, ZoneDashboardMetrics>()
        for (const row of (pegadaRows ?? []) as PegadaRow[]) {
          const parsed = parsePegadaPayload(row)
          const current = zoneMap.get(parsed.zone) ?? {
            zone: parsed.zone,
            realFt: 0,
            realBotes: 0,
            plannedFt: 0,
            plannedBotes: 0,
          }

          current.realFt += parsed.realFt
          current.realBotes += parsed.realBotes
          current.plannedFt += parsed.plannedFt
          current.plannedBotes += parsed.plannedBotes

          zoneMap.set(parsed.zone, current)
        }

        metricsByZone = [...zoneMap.values()].sort((a, b) => a.zone.localeCompare(b.zone))
      }
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "No se pudo cargar el dashboard."
  }

  const selectedProject = params.project ?? projectRows[0]?.project_id ?? null

  const projectOptions = projectRows
    .map((item) => item.project_id)
    .filter((item): item is string => Boolean(item))

  const realFtTotal = metricsByZone.reduce((sum, item) => sum + item.realFt, 0)
  const realBotesTotal = metricsByZone.reduce((sum, item) => sum + item.realBotes, 0)
  const plannedFtTotal = metricsByZone.reduce((sum, item) => sum + item.plannedFt, 0)
  const plannedBotesTotal = metricsByZone.reduce((sum, item) => sum + item.plannedBotes, 0)

  const coefGlobal = realFtTotal > 0 ? realBotesTotal / realFtTotal : null
  const remainingFt = plannedFtTotal > 0 ? Math.max(plannedFtTotal - realFtTotal, 0) : null
  const predictedTotal =
    coefGlobal !== null && remainingFt !== null ? realBotesTotal + remainingFt * coefGlobal : null
  const globalDeviation =
    plannedBotesTotal > 0 ? ((realBotesTotal - plannedBotesTotal) / plannedBotesTotal) * 100 : null

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-neutral-400">Pulse / Dashboard</p>
          <h1 className="text-3xl font-bold">Control de Producción</h1>
          <p className="text-neutral-300">4 widgets clave: progreso, desviación, coeficiente y predicción.</p>
        </header>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-3 text-sm text-neutral-400">Proyecto activo</p>
          <div className="flex flex-wrap gap-2">
            {projectOptions.length === 0 ? (
              <p className="text-sm text-neutral-400">Aún no hay datos en nube para mostrar dashboard.</p>
            ) : (
              projectOptions.map((projectId) => {
                const active = projectId === selectedProject
                return (
                  <Link
                    key={projectId}
                    href={`/dashboard?project=${encodeURIComponent(projectId)}`}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "border border-neutral-700 bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                    }`}
                  >
                    {projectId}
                  </Link>
                )
              })
            )}
          </div>
        </section>

        {loadError ? (
          <section className="rounded-2xl border border-red-500/70 bg-red-500/10 p-4 text-red-300">
            Error cargando dashboard: {loadError}
          </section>
        ) : null}

        {selectedProject ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-sm text-neutral-400">Real Ft Total</p>
              <p className="mt-2 text-3xl font-bold">{num(realFtTotal, 1)}</p>
            </article>
            <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-sm text-neutral-400">Botes Reales</p>
              <p className="mt-2 text-3xl font-bold">{num(realBotesTotal, 1)}</p>
            </article>
            <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-sm text-neutral-400">Coeficiente Global</p>
              <p className="mt-2 text-3xl font-bold">{num(coefGlobal, 5)}</p>
            </article>
            <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-sm text-neutral-400">Desviación Global</p>
              <p className="mt-2 text-3xl font-bold">{pct(globalDeviation)}</p>
            </article>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">Dashboard 1 · Progreso por Zona</h2>
            <p className="mt-1 text-sm text-neutral-400">`progress = real_ft / planned_ft` (si existe planeado).</p>
            <div className="mt-4 space-y-2">
              {metricsByZone.length === 0 ? (
                <p className="text-sm text-neutral-400">Sin registros de pegada para este proyecto.</p>
              ) : (
                metricsByZone.map((item) => {
                  const progress = item.plannedFt > 0 ? (item.realFt / item.plannedFt) * 100 : null
                  return (
                    <div key={`p-${item.zone}`} className="rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                      <p className="font-semibold">{item.zone}</p>
                      <p className="text-sm text-neutral-300">Real: {num(item.realFt, 1)} ft</p>
                      <p className="text-sm text-neutral-300">Planeado: {num(item.plannedFt > 0 ? item.plannedFt : null, 1)} ft</p>
                      <p className="text-sm text-emerald-300">Progreso: {pct(progress)}</p>
                    </div>
                  )
                })
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">Dashboard 2 · Adhesivo Real vs Planeado</h2>
            <p className="mt-1 text-sm text-neutral-400">`deviation = (real_botes - planned_botes) / planned_botes`.</p>
            <div className="mt-4 space-y-2">
              {metricsByZone.length === 0 ? (
                <p className="text-sm text-neutral-400">Sin datos de adhesivo por zona.</p>
              ) : (
                metricsByZone.map((item) => {
                  const deviation =
                    item.plannedBotes > 0 ? ((item.realBotes - item.plannedBotes) / item.plannedBotes) * 100 : null
                  return (
                    <div key={`d-${item.zone}`} className="rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                      <p className="font-semibold">{item.zone}</p>
                      <p className="text-sm text-neutral-300">Real: {num(item.realBotes, 2)} botes</p>
                      <p className="text-sm text-neutral-300">Planeado: {num(item.plannedBotes > 0 ? item.plannedBotes : null, 2)} botes</p>
                      <p className="text-sm text-amber-300">Desviación: {pct(deviation)}</p>
                    </div>
                  )
                })
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">Dashboard 3 · Coeficiente por Zona</h2>
            <p className="mt-1 text-sm text-neutral-400">`coef = real_botes / real_ft`.</p>
            <div className="mt-4 space-y-2">
              {metricsByZone.length === 0 ? (
                <p className="text-sm text-neutral-400">Sin datos para calcular coeficiente.</p>
              ) : (
                metricsByZone.map((item) => {
                  const coef = item.realFt > 0 ? item.realBotes / item.realFt : null
                  return (
                    <div key={`c-${item.zone}`} className="rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                      <p className="font-semibold">{item.zone}</p>
                      <p className="text-sm text-cyan-300">Coeficiente: {num(coef, 5)}</p>
                    </div>
                  )
                })
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">Dashboard 4 · Predicción Final</h2>
            <p className="mt-1 text-sm text-neutral-400">
              `predicted_total = real_botes + (remaining_ft * coef_global)`.
            </p>
            <div className="mt-4 space-y-2 rounded-xl border border-neutral-700 bg-neutral-950 p-4">
              <p className="text-sm text-neutral-300">Ft planeado total: {num(plannedFtTotal > 0 ? plannedFtTotal : null, 1)}</p>
              <p className="text-sm text-neutral-300">Ft restante: {num(remainingFt, 1)}</p>
              <p className="text-sm text-neutral-300">Coef global: {num(coefGlobal, 5)}</p>
              <p className="text-lg font-semibold text-blue-300">
                Proyección final de botes: {num(predictedTotal, 2)}
              </p>
              {plannedFtTotal <= 0 ? (
                <p className="text-xs text-neutral-400">
                  Para activar progreso/predicción real, incluye `planned_ft` y `planned_botes` en capturas de pegada.
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
