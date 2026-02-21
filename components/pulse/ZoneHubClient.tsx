"use client"

import Link from "next/link"
import { useMemo } from "react"

import { ensureProjectZones, getProjectById, getZoneProgress } from "../../lib/projects"

type ZoneHubClientProps = {
  projectId: string | null
}

export default function ZoneHubClient({ projectId }: ZoneHubClientProps) {
  const project = useMemo(() => (projectId ? getProjectById(projectId) : null), [projectId])
  const zones = useMemo(() => {
    if (!projectId || !project) return []
    return ensureProjectZones(projectId, project.fieldType)
  }, [projectId, project])

  const grouped = useMemo(() => {
    const map: Record<string, typeof zones> = {}
    zones.forEach((zone) => {
      if (!map[zone.macroZone]) map[zone.macroZone] = []
      map[zone.macroZone].push(zone)
    })
    return map
  }, [zones])

  if (!projectId || !project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-4 text-white">
        <h1 className="text-2xl font-bold">Falta seleccionar proyecto</h1>
        <p className="text-center text-neutral-400">Primero elige un proyecto para abrir zonas de captura.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700">
          Ir a proyectos
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-neutral-400">Pulse / Proyecto / {project.id}</p>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-neutral-300">Zonas del proyecto por deporte. Entra a una zona para capturar procesos.</p>
        </header>

        {Object.entries(grouped).map(([macroZone, list]) => (
          <section key={macroZone} className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">{macroZone}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((zone) => {
                const progress = getZoneProgress(zone)
                const statusCls =
                  progress >= 100
                    ? "border-emerald-500/80 bg-emerald-500/10"
                    : progress > 0
                      ? "border-amber-500/80 bg-amber-500/10"
                      : "border-neutral-700 bg-neutral-950"

                return (
                  <Link
                    key={zone.id}
                    href={`/pulse/zones/${encodeURIComponent(zone.id)}?project=${encodeURIComponent(project.id)}`}
                    className={`rounded-xl border p-4 transition hover:border-blue-500 ${statusCls}`}
                  >
                    <p className="font-semibold">{zone.microZone}</p>
                    <p className="mt-1 text-xs text-neutral-400">Tipo: {zone.zoneType}</p>
                    <p className="mt-3 text-sm text-neutral-300">Progreso: {progress}%</p>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/projects?flow=load"
            className="w-full rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
          >
            Cambiar proyecto
          </Link>
          <Link
            href={`/capture/material?project=${encodeURIComponent(project.id)}`}
            className="w-full rounded-xl border border-emerald-500 px-4 py-3 text-center font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Ir a fase de material
          </Link>
          <Link
            href={`/pulse/history?project=${encodeURIComponent(project.id)}`}
            className="w-full rounded-xl border border-amber-500 px-4 py-3 text-center font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            Ver historial
          </Link>
          <Link
            href={`/capture?project=${encodeURIComponent(project.id)}`}
            className="w-full rounded-xl border border-blue-500 px-4 py-3 text-center font-semibold text-blue-300 hover:bg-blue-500/10"
          >
            Abrir módulos legacy
          </Link>
        </div>
      </section>
    </main>
  )
}
