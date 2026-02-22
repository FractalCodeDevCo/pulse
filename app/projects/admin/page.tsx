"use client"

import Link from "next/link"
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"

import { createProject, readProjectsFromStorage, saveProjects, slugifyProjectName } from "../../../lib/projects"
import { buildEmptyZoneTargets, getSetupZones, inferSetupCompleted, ZoneTarget } from "../../../lib/projectSetup"
import { FIELD_TYPE_LABELS, FieldType, saveProjectFieldType } from "../../../types/fieldType"

type ProjectSetupView = {
  totalSqft: number | null
  startDate: string | null
  crewName: string
  notes: string
  planFiles: string[]
  zoneTargets: ZoneTarget[]
  setupCompleted: boolean
}

type LocalProject = {
  id: string
  name: string
  fieldType: FieldType
  createdAt: string
  setup?: ProjectSetupView
  setupCompleted?: boolean
}

function mergeProjects(localProjects: LocalProject[], remoteProjects: LocalProject[]): LocalProject[] {
  const map = new Map<string, LocalProject>()

  for (const project of remoteProjects) {
    map.set(project.id, project)
  }
  for (const project of localProjects) {
    if (!map.has(project.id)) map.set(project.id, project)
  }

  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function syncTargetsForSport(fieldType: FieldType, current: ZoneTarget[]): ZoneTarget[] {
  const targetZones = getSetupZones(fieldType)
  const currentMap = new Map(current.map((row) => [row.zone, row]))

  return targetZones.map((zone) => {
    const found = currentMap.get(zone)
    if (found) return found
    return {
      zone,
      plannedSqft: null,
      plannedRolls: null,
      plannedAdhesiveUnits: null,
      plannedSeamFt: null,
    }
  })
}

export default function ProjectsAdminPage() {
  const [projects, setProjects] = useState<LocalProject[]>(() => readProjectsFromStorage())
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [fieldType, setFieldType] = useState<FieldType>("beisbol")

  const [totalSqft, setTotalSqft] = useState("")
  const [startDate, setStartDate] = useState("")
  const [crewName, setCrewName] = useState("")
  const [notes, setNotes] = useState("")
  const [zoneTargets, setZoneTargets] = useState<ZoneTarget[]>(() => buildEmptyZoneTargets("beisbol"))
  const [planFiles, setPlanFiles] = useState<File[]>([])
  const [uploadedPlanUrls, setUploadedPlanUrls] = useState<string[]>([])

  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCloudProjects() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" })
        const data = (await response.json()) as { projects?: LocalProject[] }
        if (!response.ok || !Array.isArray(data.projects)) return
        if (cancelled) return

        setProjects((prev) => {
          const merged = mergeProjects(prev, data.projects ?? [])
          saveProjects(merged)
          return merged
        })
      } catch {
        // keep local list
      }
    }

    void loadCloudProjects()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setZoneTargets((prev) => syncTargetsForSport(fieldType, prev))
  }, [fieldType])

  const previewSetupCompleted = useMemo(() => {
    return inferSetupCompleted(
      toNumberOrNull(totalSqft),
      startDate || null,
      crewName,
      zoneTargets,
    )
  }, [crewName, startDate, totalSqft, zoneTargets])

  function handleFieldTypeChange(next: FieldType) {
    setFieldType(next)
  }

  function updateZoneTarget(zone: string, key: keyof ZoneTarget, rawValue: string) {
    const numericValue = toNumberOrNull(rawValue)
    setZoneTargets((current) =>
      current.map((row) => {
        if (row.zone !== zone) return row
        return {
          ...row,
          [key]: numericValue,
        }
      }),
    )
  }

  function handlePlanFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setPlanFiles((current) => [...current, ...files].slice(0, 20))
  }

  function removePlanFile(index: number) {
    setPlanFiles((current) => current.filter((_, i) => i !== index))
  }

  async function uploadPlans(projectId: string): Promise<string[]> {
    if (planFiles.length === 0) return uploadedPlanUrls

    const form = new FormData()
    form.append("projectId", projectId)
    for (const file of planFiles) {
      form.append("files", file)
    }

    const response = await fetch("/api/project-plans", {
      method: "POST",
      body: form,
    })

    const data = (await response.json()) as { error?: string; files?: Array<{ url: string }> }
    if (!response.ok) throw new Error(data.error ?? "No se pudieron subir los planos.")

    const urls = (data.files ?? []).map((item) => item.url).filter(Boolean)
    return [...uploadedPlanUrls, ...urls]
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!name.trim()) {
      setError("Nombre del proyecto es requerido.")
      return
    }

    const projectId = slugifyProjectName(code.trim() || name.trim())
    if (!projectId) {
      setError("Código inválido.")
      return
    }

    const nextProject = createProject({
      id: projectId,
      name: name.trim(),
      fieldType,
    })

    const nextProjects = [nextProject, ...projects.filter((project) => project.id !== nextProject.id)]
    setProjects(nextProjects)
    saveProjects(nextProjects)
    saveProjectFieldType(nextProject.id, nextProject.fieldType)

    setIsSubmitting(true)

    try {
      const allPlanUrls = await uploadPlans(projectId)
      setUploadedPlanUrls(allPlanUrls)

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: nextProject.id,
          name: nextProject.name,
          fieldType: nextProject.fieldType,
          setup: {
            totalSqft: toNumberOrNull(totalSqft),
            startDate: startDate || null,
            crewName,
            notes,
            zoneTargets,
            planFiles: allPlanUrls,
            setupCompleted: previewSetupCompleted,
          },
        }),
      })

      const data = (await response.json()) as { error?: string; project?: LocalProject }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar en nube")

      const savedProject = data.project
      if (savedProject) {
        setProjects((current) => mergeProjects(current, [savedProject]))
      }

      setMessage("Proyecto + setup base guardados. Ya aparece en Nuevo/Cargar proyecto.")
      setPlanFiles([])
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo guardar en nube"
      setMessage(`Guardado local OK. Error nube: ${text}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-neutral-400">Pulse / Admin</p>
          <h1 className="text-3xl font-bold">Setup Base de Proyecto</h1>
          <p className="text-neutral-300">
            Lo llena PM/Admin. Instalador solo recibe proyecto y captura.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">1) Proyecto</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-neutral-300">Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Proyecto Navidad"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-neutral-300">Código (opcional)</span>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="proyecto-navidad"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-neutral-300">Deporte</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((item) => {
                const active = fieldType === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleFieldTypeChange(item)}
                    className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "border border-neutral-700 bg-neutral-950 hover:bg-neutral-800"
                    }`}
                  >
                    {FIELD_TYPE_LABELS[item]}
                  </button>
                )
              })}
            </div>
          </div>

          <h2 className="pt-2 text-xl font-semibold">2) Baseline mínimo (PM/Admin)</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-neutral-300">Total Sqft</span>
              <input
                type="number"
                min={0}
                value={totalSqft}
                onChange={(event) => setTotalSqft(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-neutral-300">Fecha inicio</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-neutral-300">Crew</span>
              <input
                type="text"
                value={crewName}
                onChange={(event) => setCrewName(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Notas setup (opcional)</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            />
          </label>

          <h2 className="pt-2 text-xl font-semibold">3) Targets por zona</h2>
          <p className="text-sm text-neutral-400">Sin estos targets no hay comparación real Plan vs Real.</p>
          <div className="space-y-3">
            {zoneTargets.map((row) => (
              <div key={row.zone} className="space-y-2 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                <p className="font-semibold">{row.zone}</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Planned Sqft</span>
                    <input
                      type="number"
                      min={0}
                      value={row.plannedSqft ?? ""}
                      onChange={(event) => updateZoneTarget(row.zone, "plannedSqft", event.target.value)}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Planned Rolls</span>
                    <input
                      type="number"
                      min={0}
                      value={row.plannedRolls ?? ""}
                      onChange={(event) => updateZoneTarget(row.zone, "plannedRolls", event.target.value)}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Planned Adhesive</span>
                    <input
                      type="number"
                      min={0}
                      value={row.plannedAdhesiveUnits ?? ""}
                      onChange={(event) => updateZoneTarget(row.zone, "plannedAdhesiveUnits", event.target.value)}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Planned Seam Ft</span>
                    <input
                      type="number"
                      min={0}
                      value={row.plannedSeamFt ?? ""}
                      onChange={(event) => updateZoneTarget(row.zone, "plannedSeamFt", event.target.value)}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <h2 className="pt-2 text-xl font-semibold">4) Planos</h2>
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Agregar planos (PDF/Imagen)</span>
            <input
              type="file"
              accept=".pdf,image/*,.dwg,.dxf"
              multiple
              onChange={handlePlanFiles}
              className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
            />
          </label>

          {planFiles.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
              {planFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                  <p className="truncate text-neutral-200">{file.name}</p>
                  <button
                    type="button"
                    onClick={() => removePlanFile(index)}
                    className="rounded-lg border border-neutral-600 px-2 py-1 hover:bg-neutral-800"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <p
            className={`rounded-xl border px-3 py-2 text-sm ${
              previewSetupCompleted
                ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/70 bg-amber-500/10 text-amber-200"
            }`}
          >
            Estado setup: {previewSetupCompleted ? "Completo" : "Incompleto"}
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Guardar proyecto + setup base
          </button>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        </form>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Proyectos disponibles</h2>
          <div className="space-y-2">
            {projects.map((project) => (
              <div key={project.id} className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2">
                <p className="font-semibold">{project.name}</p>
                <p className="text-xs text-neutral-400">
                  {project.id} · {FIELD_TYPE_LABELS[project.fieldType]} · Alta: {formatDate(project.createdAt)}
                </p>
                <p className={`text-xs ${project.setupCompleted ? "text-emerald-300" : "text-amber-300"}`}>
                  Setup: {project.setupCompleted ? "Completo" : "Incompleto"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Link
          href="/projects?flow=new"
          className="block rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
        >
          Volver a proyectos
        </Link>
      </section>
    </main>
  )
}
