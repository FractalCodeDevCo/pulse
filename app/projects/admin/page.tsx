"use client"

import Link from "next/link"
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"

import ContextHeader from "../../../components/pulse/ContextHeader"
import { analyzePlanScaffold } from "../../../lib/planIntelligence/client"
import { savePlanAnalysisCache } from "../../../lib/planIntelligence/cache"
import { createProject, readProjectsFromStorage, saveProjects, slugifyProjectName } from "../../../lib/projects"
import { buildEmptyZoneTargets, getSetupZones, inferSetupCompleted, suggestZoneTargetsFromPlanAnalysis, ZoneTarget } from "../../../lib/projectSetup"
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

type UploadedPlanFile = {
  name: string
  url: string
  contentType: string
  size: number
  uploadedAt: string
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

function toSetupTargets(project: LocalProject): ZoneTarget[] {
  const current = project.setup?.zoneTargets ?? buildEmptyZoneTargets(project.fieldType)
  return syncTargetsForSport(project.fieldType, current)
}

export default function ProjectsAdminPage() {
  const [requestedEditId, setRequestedEditId] = useState("")
  const [projects, setProjects] = useState<LocalProject[]>(() => readProjectsFromStorage())
  const [editingProjectId, setEditingProjectId] = useState<string>(requestedEditId)
  const [loadedProjectId, setLoadedProjectId] = useState<string>("")

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

  const editingProject = useMemo(
    () => projects.find((project) => project.id === editingProjectId) ?? null,
    [editingProjectId, projects],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setRequestedEditId(params.get("edit")?.trim() ?? "")
  }, [])

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
    if (!requestedEditId) return
    setEditingProjectId(requestedEditId)
    setLoadedProjectId("")
  }, [requestedEditId])

  useEffect(() => {
    setZoneTargets((prev) => syncTargetsForSport(fieldType, prev))
  }, [fieldType])

  useEffect(() => {
    if (!editingProjectId) return
    if (loadedProjectId === editingProjectId) return

    const project = projects.find((item) => item.id === editingProjectId)
    if (!project) return

    const setup = project.setup
    setName(project.name)
    setCode(project.id)
    setFieldType(project.fieldType)
    setTotalSqft(setup?.totalSqft != null ? String(setup.totalSqft) : "")
    setStartDate(setup?.startDate ?? "")
    setCrewName(setup?.crewName ?? "")
    setNotes(setup?.notes ?? "")
    setZoneTargets(toSetupTargets(project))
    setUploadedPlanUrls(setup?.planFiles ?? [])
    setPlanFiles([])
    setLoadedProjectId(editingProjectId)
  }, [editingProjectId, loadedProjectId, projects])

  const previewSetupCompleted = useMemo(() => {
    return inferSetupCompleted(toNumberOrNull(totalSqft), startDate || null, crewName, zoneTargets)
  }, [crewName, startDate, totalSqft, zoneTargets])

  function resetFormForNewProject() {
    setEditingProjectId("")
    setLoadedProjectId("")
    setName("")
    setCode("")
    setFieldType("beisbol")
    setTotalSqft("")
    setStartDate("")
    setCrewName("")
    setNotes("")
    setZoneTargets(buildEmptyZoneTargets("beisbol"))
    setPlanFiles([])
    setUploadedPlanUrls([])
    setError("")
    setMessage("")
  }

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

  function removeUploadedPlan(index: number) {
    setUploadedPlanUrls((current) => current.filter((_, i) => i !== index))
  }

  async function uploadPlans(projectId: string): Promise<UploadedPlanFile[]> {
    if (planFiles.length === 0) return []

    const form = new FormData()
    form.append("projectId", projectId)
    for (const file of planFiles) {
      form.append("files", file)
    }

    const response = await fetch("/api/project-plans", {
      method: "POST",
      body: form,
    })

    const data = (await response.json()) as { error?: string; files?: UploadedPlanFile[] }
    if (!response.ok) throw new Error(data.error ?? "No se pudieron subir los planos.")

    return (data.files ?? []).filter((item) => Boolean(item.url))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    const isEditing = Boolean(editingProjectId)
    const existing = isEditing ? projects.find((project) => project.id === editingProjectId) ?? null : null

    const projectName = name.trim() || existing?.name || ""
    if (!projectName) {
      setError("Nombre del proyecto es requerido.")
      return
    }

    const projectId = existing?.id ?? slugifyProjectName(code.trim() || projectName)
    if (!projectId) {
      setError("Código inválido.")
      return
    }

    const nextProject =
      existing ??
      createProject({
        id: projectId,
        name: projectName,
        fieldType,
      })

    const hydratedProject: LocalProject = {
      ...nextProject,
      name: projectName,
      fieldType,
    }

    const nextProjects = [hydratedProject, ...projects.filter((project) => project.id !== hydratedProject.id)]
    setProjects(nextProjects)
    saveProjects(nextProjects)
    saveProjectFieldType(hydratedProject.id, hydratedProject.fieldType)

    setIsSubmitting(true)

    try {
      const uploadedPlans = await uploadPlans(projectId)
      const allPlanUrls = [...new Set([...uploadedPlanUrls, ...uploadedPlans.map((item) => item.url)])]
      setUploadedPlanUrls(allPlanUrls)

      let autoZoneTargets = zoneTargets
      if (uploadedPlans.length > 0) {
        try {
          const analysis = await analyzePlanScaffold(
            projectId,
            uploadedPlans.map((file) => ({
              name: file.name,
              url: file.url,
              contentType: file.contentType,
              size: file.size,
            })),
          )
          autoZoneTargets = suggestZoneTargetsFromPlanAnalysis(fieldType, zoneTargets, analysis)
          setZoneTargets(autoZoneTargets)
          savePlanAnalysisCache(projectId, analysis)
          setMessage(
            `IA draft: ${analysis.stats.uniqueRollLabels} roll labels detectados. Se sugirieron targets por zona (revisa antes de guardar).`,
          )
        } catch {
          // fallback to manual targets
        }
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: hydratedProject.id,
          name: projectName,
          fieldType,
          setup: {
            totalSqft: toNumberOrNull(totalSqft),
            startDate: startDate || null,
            crewName,
            notes,
            zoneTargets: autoZoneTargets,
            planFiles: allPlanUrls,
            setupCompleted: inferSetupCompleted(toNumberOrNull(totalSqft), startDate || null, crewName, autoZoneTargets),
          },
        }),
      })

      const data = (await response.json()) as { error?: string; project?: LocalProject }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar en nube")

      const savedProject = data.project
      if (savedProject) {
        setProjects((current) => mergeProjects(current, [savedProject]))
      }

      setLoadedProjectId(hydratedProject.id)
      setEditingProjectId(hydratedProject.id)
      setPlanFiles([])
      setMessage(
        isEditing
          ? "Setup actualizado. Puedes editar targets/planos a mitad del proyecto cuando quieras."
          : "Proyecto + setup base guardados. Ya aparece en Nuevo/Cargar proyecto.",
      )
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
        <ContextHeader
          title="Setup Base de Proyecto"
          subtitle="Lo llena PM/Admin. Instalador solo recibe proyecto y captura."
          backHref="/projects?flow=load"
          backLabel="Proyectos"
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: "Proyectos", href: "/projects?flow=load" },
            { label: "Admin Setup" },
          ]}
          statusLabel="Administración"
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />

        <section className="space-y-3 rounded-2xl border border-cyan-900/70 bg-cyan-950/20 p-4">
          <h2 className="text-lg font-semibold text-cyan-100">Carga de plano y edición de setup</h2>
          <p className="text-sm text-cyan-50/90">
            Aquí se carga el plano inicial (normalmente una sola vez por PM/Admin) y aquí mismo puedes editar valores a mitad de
            proyecto sin perder el flujo de captura.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="space-y-2">
              <span className="text-xs text-cyan-100">Proyecto a editar (opcional)</span>
              <select
                value={editingProjectId}
                onChange={(event) => {
                  const nextId = event.target.value
                  if (!nextId) {
                    resetFormForNewProject()
                    return
                  }
                  setEditingProjectId(nextId)
                  setLoadedProjectId("")
                  setMessage("")
                  setError("")
                }}
                className="w-full rounded-xl border border-cyan-800/70 bg-neutral-950 px-3 py-3"
              >
                <option value="">Crear nuevo proyecto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} · {project.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={resetFormForNewProject}
              className="self-end rounded-xl border border-cyan-700/80 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-600/10"
            >
              Nuevo limpio
            </button>
          </div>
        </section>

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
              <span className="text-sm text-neutral-300">Código {editingProject ? "(bloqueado en edición)" : "(opcional)"}</span>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={Boolean(editingProject)}
                placeholder="proyecto-navidad"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 disabled:cursor-not-allowed disabled:opacity-60"
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
                      active ? "bg-emerald-600 text-white" : "border border-neutral-700 bg-neutral-950 hover:bg-neutral-800"
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

          <h2 className="pt-2 text-xl font-semibold">4) Planos (PM/Admin)</h2>
          <p className="text-sm text-neutral-400">
            Cárgalos aquí al inicio del proyecto. También puedes agregar o quitar planos después en modo edición.
          </p>
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

          {uploadedPlanUrls.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Planos ya guardados en el proyecto</p>
              {uploadedPlanUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                  <a href={url} target="_blank" rel="noreferrer" className="truncate text-cyan-200 underline">
                    {url.split("/").pop() ?? `Plano ${index + 1}`}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeUploadedPlan(index)}
                    className="rounded-lg border border-cyan-700/80 px-2 py-1 text-cyan-100 hover:bg-cyan-700/20"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}

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
            {editingProject ? "Actualizar setup base" : "Guardar proyecto + setup base"}
          </button>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        </form>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Proyectos disponibles</h2>
          <div className="space-y-2">
            {projects.map((project) => (
              <div key={project.id} className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-xs text-neutral-400">
                      {project.id} · {FIELD_TYPE_LABELS[project.fieldType]} · Alta: {formatDate(project.createdAt)}
                    </p>
                    <p className={`text-xs ${project.setupCompleted ? "text-emerald-300" : "text-amber-300"}`}>
                      Setup: {project.setupCompleted ? "Completo" : "Incompleto"}
                    </p>
                  </div>
                  <Link
                    href={`/projects/admin?edit=${encodeURIComponent(project.id)}`}
                    className="rounded-lg border border-cyan-700/80 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-700/20"
                  >
                    Editar setup
                  </Link>
                </div>
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
