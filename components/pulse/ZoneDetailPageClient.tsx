"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import {
  getProjectById,
  getProjectZoneById,
  getZoneProgress,
  getZoneStepTemplates,
  toggleProjectZoneStep,
  ZoneStepKey,
} from "../../lib/projects"

type ZoneDetailPageClientProps = {
  projectId: string | null
  projectZoneId: string
}

export default function ZoneDetailPageClient({ projectId, projectZoneId }: ZoneDetailPageClientProps) {
  const project = useMemo(() => (projectId ? getProjectById(projectId) : null), [projectId])
  const [zone, setZone] = useState(() =>
    projectId ? getProjectZoneById(projectId, projectZoneId) : null,
  )

  const stepTemplates = useMemo(() => (zone ? getZoneStepTemplates(zone.zoneType) : []), [zone])
  const progress = zone ? getZoneProgress(zone) : 0

  function toggleStep(stepKey: ZoneStepKey) {
    if (!projectId || !zone) return
    const updated = toggleProjectZoneStep(projectId, zone.id, stepKey)
    if (updated) setZone(updated)
  }

  if (!projectId || !project || !zone) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Zona no encontrada para este proyecto.</p>
        <Link href={`/pulse?project=${encodeURIComponent(projectId ?? "")}`} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold">
          Volver a zonas
        </Link>
      </main>
    )
  }

  const query = new URLSearchParams({
    project: project.id,
    projectZoneId: zone.id,
    macroZone: zone.macroZone,
    microZone: zone.microZone,
    fieldType: zone.fieldType,
    zoneType: zone.zoneType,
  }).toString()

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-neutral-400">Pulse / {project.name}</p>
          <h1 className="text-3xl font-bold">{zone.microZone}</h1>
          <p className="text-neutral-300">
            MacroZona: {zone.macroZone} · Tipo: {zone.zoneType} · Progreso: {progress}%
          </p>
        </header>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Proceso interno de zona</h2>
          <div className="space-y-2">
            {stepTemplates.map((step) => {
              const completed = zone.completedStepKeys.includes(step.key)
              return (
                <div
                  key={step.key}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    completed ? "border-emerald-500/70 bg-emerald-500/10" : "border-neutral-700 bg-neutral-950"
                  }`}
                >
                  <div>
                    <p className="font-medium">{step.label}</p>
                    <p className="text-xs text-neutral-400">{step.key}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStep(step.key)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      completed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-neutral-700 hover:bg-neutral-600"
                    }`}
                  >
                    {completed ? "Completado" : "Marcar"}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Capturas de zona</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/pulse/roll-installation?${query}`}
              className="rounded-xl bg-orange-600 py-3 text-center font-semibold hover:bg-orange-700"
            >
              Roll Installation
            </Link>
            <Link
              href={`/pulse/roll-verification?${query}`}
              className="rounded-xl bg-cyan-600 py-3 text-center font-semibold hover:bg-cyan-700"
            >
              Roll Verification
            </Link>
            <Link
              href={`/capture/pegada?${query}`}
              className="rounded-xl bg-green-600 py-3 text-center font-semibold hover:bg-green-700"
            >
              Pegada
            </Link>
            <Link
              href={`/capture/material?${query}`}
              className="rounded-xl bg-blue-600 py-3 text-center font-semibold hover:bg-blue-700"
            >
              Material
            </Link>
          </div>
          <Link
            href={`/capture/incidencias?${query}`}
            className="block rounded-xl border border-red-500 py-3 text-center font-semibold text-red-300 hover:bg-red-500/10"
          >
            Incidencias
          </Link>
        </section>

        <Link
          href={`/pulse?project=${encodeURIComponent(project.id)}`}
          className="block rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
        >
          Volver a zonas
        </Link>
      </section>
    </main>
  )
}
