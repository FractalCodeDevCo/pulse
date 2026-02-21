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
  const [zone, setZone] = useState(() => (projectId ? getProjectZoneById(projectId, projectZoneId) : null))
  const [openStep, setOpenStep] = useState<ZoneStepKey | null>(null)
  const [quickNotes, setQuickNotes] = useState<Record<string, string>>({})

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
          <p className="text-sm text-neutral-400">
            Selecciona un proceso para abrir su menú. Solo Roll Placement y Adhesive llevan cuestionario completo.
          </p>

          <div className="space-y-2">
            {stepTemplates.map((step) => {
              const completed = zone.completedStepKeys.includes(step.key)
              const expanded = openStep === step.key

              return (
                <div key={step.key} className="rounded-xl border border-neutral-700 bg-neutral-950">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenStep((prev) => (prev === step.key ? null : step.key))}
                      className="text-left"
                    >
                      <p className="font-medium">{step.label}</p>
                      <p className="text-xs text-neutral-400">{step.key}</p>
                    </button>
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

                  {expanded ? (
                    <div className="space-y-3 border-t border-neutral-800 px-4 py-4">
                      {step.key === "ROLL_PLACEMENT" ? (
                        <>
                          <p className="text-sm text-neutral-300">Cuestionario de roll placement + compactación.</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Link
                              href={`/pulse/roll-installation?${query}`}
                              className="rounded-xl bg-orange-600 py-3 text-center font-semibold hover:bg-orange-700"
                            >
                              Abrir Roll Installation
                            </Link>
                            <Link
                              href={`/pulse/roll-verification?${query}`}
                              className="rounded-xl border border-cyan-500 py-3 text-center font-semibold text-cyan-300 hover:bg-cyan-500/10"
                            >
                              Roll Verification
                            </Link>
                          </div>
                        </>
                      ) : null}

                      {step.key === "ADHESIVE" ? (
                        <>
                          <p className="text-sm text-neutral-300">Cuestionario de adhesive (Pegada).</p>
                          <Link
                            href={`/capture/pegada?${query}`}
                            className="block rounded-xl bg-green-600 py-3 text-center font-semibold hover:bg-green-700"
                          >
                            Abrir Adhesive (Pegada)
                          </Link>
                        </>
                      ) : null}

                      {step.key !== "ROLL_PLACEMENT" && step.key !== "ADHESIVE" ? (
                        <>
                          <p className="text-sm text-neutral-300">Registro rápido de proceso (sin cuestionario largo).</p>
                          <label className="block space-y-2">
                            <span className="text-sm text-neutral-300">Nota rápida (opcional)</span>
                            <textarea
                              rows={2}
                              value={quickNotes[step.key] ?? ""}
                              onChange={(event) =>
                                setQuickNotes((prev) => ({ ...prev, [step.key]: event.target.value }))
                              }
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleStep(step.key)}
                            className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800"
                          >
                            Marcar paso {step.label}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Procesos aparte (fuera del flujo principal)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/capture/material?${query}`}
              className="rounded-xl bg-blue-600 py-3 text-center font-semibold hover:bg-blue-700"
            >
              Material
            </Link>
            <Link
              href={`/capture/incidencias?${query}`}
              className="rounded-xl border border-red-500 py-3 text-center font-semibold text-red-300 hover:bg-red-500/10"
            >
              Incidencias
            </Link>
          </div>
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
