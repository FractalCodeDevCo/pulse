"use client"

import Link from "next/link"
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"

import ContextHeader from "../../../components/pulse/ContextHeader"
import { analyzePlanScaffold } from "../../../lib/planIntelligence/client"
import { readPlanAnalysisCache, savePlanAnalysisCache } from "../../../lib/planIntelligence/cache"
import { PlanAnalysisResult, PlanFileRef } from "../../../lib/planIntelligence/types"
import { buildComplexUnits, defaultFieldUnitsConfig, FieldUnit, saveFieldUnitsConfig, SiteType, readFieldUnitsConfig } from "../../../lib/fieldUnits"
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

type UploadPlansResult = {
  files: UploadedPlanFile[]
  analysis: PlanAnalysisResult | null
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

function buildPlanRefsFromUrls(urls: string[]): PlanFileRef[] {
  return urls.map((url, index) => {
    const fallbackName = `plan_${index + 1}.pdf`
    try {
      const parsed = new URL(url)
      const name = parsed.pathname.split("/").pop() || fallbackName
      return {
        name,
        url,
        contentType: name.toLowerCase().endsWith(".pdf") ? "application/pdf" : undefined,
      }
    } catch {
      return { name: fallbackName, url, contentType: "application/pdf" }
    }
  })
}

function summarizePlannedSqft(rows: ZoneTarget[]): number {
  return rows.reduce((sum, row) => sum + (row.plannedSqft ?? 0), 0)
}

function countAutofilledCells(before: ZoneTarget[], after: ZoneTarget[]): number {
  const afterByZone = new Map(after.map((row) => [row.zone, row]))
  let count = 0

  for (const prev of before) {
    const next = afterByZone.get(prev.zone)
    if (!next) continue

    if (prev.plannedSqft == null && next.plannedSqft != null) count += 1
    if (prev.plannedRolls == null && next.plannedRolls != null) count += 1
    if (prev.plannedAdhesiveUnits == null && next.plannedAdhesiveUnits != null) count += 1
    if (prev.plannedSeamFt == null && next.plannedSeamFt != null) count += 1
  }

  return count
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
  const [siteType, setSiteType] = useState<SiteType>("single")
  const [complexFieldCount, setComplexFieldCount] = useState(4)
  const [fieldUnits, setFieldUnits] = useState<FieldUnit[]>(() => defaultFieldUnitsConfig().units)
  const [zoneTargets, setZoneTargets] = useState<ZoneTarget[]>(() => buildEmptyZoneTargets("beisbol"))
  const [planFiles, setPlanFiles] = useState<File[]>([])
  const [uploadedPlanUrls, setUploadedPlanUrls] = useState<string[]>([])
  const [planAnalysis, setPlanAnalysis] = useState<PlanAnalysisResult | null>(null)
  const [isAnalyzingPlans, setIsAnalyzingPlans] = useState(false)
  const [lastAutofill, setLastAutofill] = useState<{
    updatedCells: number
    analyzedAt: string
    uniqueRolls: number
    rollSegments: number
  } | null>(null)

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
    if (siteType === "single") {
      setFieldUnits([{ id: "field-1", label: "Field 1" }])
      return
    }
    setFieldUnits((current) => {
      const target = Math.max(2, Math.min(20, complexFieldCount))
      if (current.length === target) return current
      const generated = buildComplexUnits(target)
      const byId = new Map(current.map((unit) => [unit.id, unit]))
      return generated.map((unit) => byId.get(unit.id) ?? unit)
    })
  }, [siteType, complexFieldCount])

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
    setPlanAnalysis(readPlanAnalysisCache(project.id))
    const fieldConfig = readFieldUnitsConfig(project.id)
    setSiteType(fieldConfig.siteType)
    setFieldUnits(fieldConfig.units)
    setComplexFieldCount(fieldConfig.units.length)
    setLastAutofill(null)
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
    setSiteType("single")
    setComplexFieldCount(4)
    setFieldUnits(defaultFieldUnitsConfig().units)
    setZoneTargets(buildEmptyZoneTargets("beisbol"))
    setPlanFiles([])
    setUploadedPlanUrls([])
    setPlanAnalysis(null)
    setIsAnalyzingPlans(false)
    setLastAutofill(null)
    setError("")
    setMessage("")
  }

  function handleFieldTypeChange(next: FieldType) {
    setFieldType(next)
  }

  function updateFieldUnitLabel(unitId: string, label: string) {
    setFieldUnits((current) => current.map((unit) => (unit.id === unitId ? { ...unit, label } : unit)))
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

  function applyPlanAnalysisToTargets(
    projectId: string,
    analysis: PlanAnalysisResult,
    baseTargets: ZoneTarget[],
    options?: { overwriteExisting?: boolean },
  ) {
    const overwriteExisting = options?.overwriteExisting === true
    const seedTargets = overwriteExisting
      ? baseTargets.map((row) => ({
          ...row,
          plannedSqft: null,
          plannedRolls: null,
          plannedAdhesiveUnits: null,
          plannedSeamFt: null,
        }))
      : baseTargets

    const suggestedTargets = suggestZoneTargetsFromPlanAnalysis(fieldType, seedTargets, analysis)
    const updatedCells = countAutofilledCells(baseTargets, suggestedTargets)
    setPlanAnalysis(analysis)
    setZoneTargets(suggestedTargets)
    setLastAutofill({
      updatedCells,
      analyzedAt: new Date().toISOString(),
      uniqueRolls: analysis.stats.uniqueRollLabels,
      rollSegments: analysis.stats.rollSegments,
    })
    savePlanAnalysisCache(projectId, analysis)

    const suggestedTotalSqft = summarizePlannedSqft(suggestedTargets)
    const currentTotalSqft = toNumberOrNull(totalSqft)
    if (suggestedTotalSqft > 0 && (overwriteExisting || !currentTotalSqft)) {
      setTotalSqft(String(suggestedTotalSqft))
    }

    return { suggestedTargets, updatedCells }
  }

  async function uploadPlans(projectId: string): Promise<UploadPlansResult> {
    if (planFiles.length === 0) return { files: [], analysis: null }

    const form = new FormData()
    form.append("projectId", projectId)
    for (const file of planFiles) {
      form.append("files", file)
    }

    const response = await fetch("/api/project-plans", {
      method: "POST",
      body: form,
    })

    const data = (await response.json()) as {
      error?: string
      code?: string
      diagnostics?: {
        bucket?: string
        keySource?: string
        keyRole?: string | null
      }
      files?: UploadedPlanFile[]
      analysis?: PlanAnalysisResult | null
    }
    if (!response.ok) {
      const detail = data.error ?? "No se pudieron subir los planos."
      const code = data.code ? ` (${data.code})` : ""
      const diagnostics = data.diagnostics
        ? ` [bucket=${data.diagnostics.bucket ?? "-"}, keySource=${data.diagnostics.keySource ?? "-"}, keyRole=${data.diagnostics.keyRole ?? "-"}]`
        : ""
      throw new Error(`${detail}${code}${diagnostics}`)
    }

    return {
      files: (data.files ?? []).filter((item) => Boolean(item.url)),
      analysis: data.analysis ?? null,
    }
  }

  async function analyzeAndApplyPlanData(
    projectId: string,
    refs: PlanFileRef[],
    baseTargets: ZoneTarget[],
  ): Promise<{ analysis: PlanAnalysisResult | null; suggestedTargets: ZoneTarget[]; updatedCells: number }> {
    if (refs.length === 0) return { analysis: null, suggestedTargets: baseTargets, updatedCells: 0 }

    setIsAnalyzingPlans(true)
    try {
      const analysis = await analyzePlanScaffold(projectId, refs)
      const { suggestedTargets, updatedCells } = applyPlanAnalysisToTargets(projectId, analysis, baseTargets)
      return { analysis, suggestedTargets, updatedCells }
    } catch {
      return { analysis: null, suggestedTargets: baseTargets, updatedCells: 0 }
    } finally {
      setIsAnalyzingPlans(false)
    }
  }

  async function handleAnalyzeSavedPlans() {
    const projectId = editingProjectId || slugifyProjectName(code.trim() || name.trim())
    if (!projectId) {
      setError("Primero define nombre/código del proyecto.")
      return
    }

    const refs = buildPlanRefsFromUrls(uploadedPlanUrls)
    if (refs.length === 0) {
      setError("No hay planos guardados para analizar.")
      return
    }

    setError("")
    const result = await analyzeAndApplyPlanData(projectId, refs, zoneTargets)
    if (!result.analysis) {
      setMessage("No se pudo analizar el plano guardado. Revisa el archivo PDF o intenta de nuevo.")
      return
    }

    setMessage(
      `Análisis actualizado: ${result.analysis.stats.uniqueRollLabels} rollos, ${result.analysis.stats.rollSegments} segmentos, CHOP ${result.analysis.stats.choppedSegments}, SPLIT ${result.analysis.stats.splitSegments}. Autofill en ${result.updatedCells} campos.`,
    )
  }

  async function handleAnalyzePlanExplicit() {
    const projectId = editingProjectId || slugifyProjectName(code.trim() || name.trim())
    if (!projectId) {
      setError("Primero define nombre/código del proyecto.")
      return
    }

    setError("")
    setMessage("")
    setIsAnalyzingPlans(true)
    try {
      let baseTargets = zoneTargets
      const uploadedResult = await uploadPlans(projectId)
      if (uploadedResult.files.length > 0) {
        const mergedUrls = [...new Set([...uploadedPlanUrls, ...uploadedResult.files.map((item) => item.url)])]
        setUploadedPlanUrls(mergedUrls)
        setPlanFiles([])
      }

      if (uploadedResult.analysis) {
        const result = applyPlanAnalysisToTargets(projectId, uploadedResult.analysis, baseTargets, {
          overwriteExisting: true,
        })
        setMessage(
          `Analyze Plan (IA): ${uploadedResult.analysis.stats.uniqueRollLabels} rollos, ${uploadedResult.analysis.stats.rollSegments} segmentos, CHOP ${uploadedResult.analysis.stats.choppedSegments}, SPLIT ${uploadedResult.analysis.stats.splitSegments}. Autofill en #3 y Total Sqft en #2 cuando hay datos.`,
        )
        return
      }

      const refs = buildPlanRefsFromUrls(uploadedPlanUrls)
      if (refs.length === 0) {
        setMessage("Sube y guarda al menos un plano para analizar.")
        return
      }
      const result = await analyzeAndApplyPlanData(projectId, refs, baseTargets)
      if (!result.analysis) {
        setMessage("No se pudo analizar el plano. Revisa formato del PDF o intenta de nuevo.")
        return
      }
      applyPlanAnalysisToTargets(projectId, result.analysis, baseTargets, {
        overwriteExisting: true,
      })
      setMessage(
        `Analyze Plan (IA): ${result.analysis.stats.uniqueRollLabels} rollos, ${result.analysis.stats.rollSegments} segmentos, CHOP ${result.analysis.stats.choppedSegments}, SPLIT ${result.analysis.stats.splitSegments}. Autofill en #3 y Total Sqft en #2 cuando hay datos.`,
      )
    } catch (analysisError) {
      const text = analysisError instanceof Error ? analysisError.message : "No se pudo analizar el plano."
      setError(text)
    } finally {
      setIsAnalyzingPlans(false)
    }
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
    saveFieldUnitsConfig(projectId, {
      siteType,
      units: fieldUnits,
      updatedAt: new Date().toISOString(),
    })

    try {
      const uploadedResult = await uploadPlans(projectId)
      const uploadedPlans = uploadedResult.files
      const allPlanUrls = [...new Set([...uploadedPlanUrls, ...uploadedPlans.map((item) => item.url)])]
      setUploadedPlanUrls(allPlanUrls)

      let autoZoneTargets = zoneTargets
      let analysisSummary = ""
      if (uploadedResult.analysis) {
        const result = applyPlanAnalysisToTargets(projectId, uploadedResult.analysis, zoneTargets)
        autoZoneTargets = result.suggestedTargets
        analysisSummary = `IA: ${uploadedResult.analysis.stats.uniqueRollLabels} rollos, CHOP ${uploadedResult.analysis.stats.choppedSegments}, SPLIT ${uploadedResult.analysis.stats.splitSegments}, Autofill ${result.updatedCells} campos.`
      } else if (allPlanUrls.length > 0 && uploadedPlans.length > 0) {
        const refs = buildPlanRefsFromUrls(allPlanUrls)
        const result = await analyzeAndApplyPlanData(projectId, refs, zoneTargets)
        autoZoneTargets = result.suggestedTargets
        if (result.analysis) {
          analysisSummary = `IA: ${result.analysis.stats.uniqueRollLabels} rollos, CHOP ${result.analysis.stats.choppedSegments}, SPLIT ${result.analysis.stats.splitSegments}, Autofill ${result.updatedCells} campos.`
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
        `${isEditing
          ? "Setup actualizado. Puedes editar targets/planos a mitad del proyecto cuando quieras."
          : "Proyecto + setup base guardados. Ya aparece en Nuevo/Cargar proyecto."}${analysisSummary ? ` ${analysisSummary}` : ""}`,
      )
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo guardar en nube"
      setError(`Error nube: ${text}`)
      setMessage("Guardado local OK.")
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

          <h2 className="pt-2 text-xl font-semibold">2.1) Configuración de Campos (Beta)</h2>
          <p className="text-sm text-neutral-400">Prueba segura: define si el proyecto tiene un solo campo o complejo (varios campos).</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-neutral-300">Tipo de sitio</span>
              <select
                value={siteType}
                onChange={(event) => setSiteType(event.target.value === "complex" ? "complex" : "single")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              >
                <option value="single">Single Field</option>
                <option value="complex">Complex (multi-field)</option>
              </select>
            </label>
            {siteType === "complex" ? (
              <label className="space-y-2">
                <span className="text-sm text-neutral-300">Número de campos</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={complexFieldCount}
                  onChange={(event) => setComplexFieldCount(Math.max(2, Math.min(20, Number(event.target.value) || 2)))}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                />
              </label>
            ) : null}
          </div>
          <div className="space-y-2 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
            <p className="text-xs text-neutral-400">Campos que se usarán para selección en captura:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {fieldUnits.map((unit) => (
                <label key={unit.id} className="space-y-1">
                  <span className="text-xs text-neutral-400">{unit.id}</span>
                  <input
                    type="text"
                    value={unit.label}
                    onChange={(event) => updateFieldUnitLabel(unit.id, event.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>

          <h2 className="pt-2 text-xl font-semibold">3) Targets por zona</h2>
          <p className="text-sm text-neutral-400">Sin estos targets no hay comparación real Plan vs Real.</p>
          {lastAutofill ? (
            <p className="rounded-lg border border-cyan-800/70 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100">
              Último análisis: {new Date(lastAutofill.analyzedAt).toLocaleString("es-MX")} · Rollos detectados: {lastAutofill.uniqueRolls} · Segmentos: {lastAutofill.rollSegments} · Campos autollenados: {lastAutofill.updatedCells}
            </p>
          ) : null}
          {planAnalysis && lastAutofill && lastAutofill.updatedCells === 0 ? (
            <p className="rounded-lg border border-amber-700/70 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              El plano se subió, pero no se autollenaron targets. Normalmente pasa cuando el PDF no trae texto extraíble de rollos/longitudes o usa otro formato. Puedes capturar targets manuales y mantener sugerencias en Roll Placement.
            </p>
          ) : null}
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAnalyzePlanExplicit}
              disabled={isAnalyzingPlans || (planFiles.length === 0 && uploadedPlanUrls.length === 0)}
              className="rounded-lg border border-cyan-700/80 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-700/20 disabled:opacity-60"
            >
              {isAnalyzingPlans ? "Analyzing Plan (IA)..." : "Analyze Plan (IA)"}
            </button>
            <p className="self-center text-xs text-neutral-400">
              Analiza el plano y autorrellena #3 Targets + #2 Total Sqft (si hay datos). Todo queda editable.
            </p>
          </div>

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
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAnalyzeSavedPlans}
                  disabled={isAnalyzingPlans}
                  className="rounded-lg border border-cyan-700/80 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-700/20 disabled:opacity-60"
                >
                  {isAnalyzingPlans ? "Analyzing saved plans..." : "Analyze saved plans (IA)"}
                </button>
              </div>
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

          {planAnalysis ? (
            <div className="space-y-3 rounded-xl border border-cyan-900/60 bg-cyan-950/15 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Plan Intelligence por proyecto</p>
              <div className="grid gap-2 text-xs text-cyan-100 sm:grid-cols-2 lg:grid-cols-4">
                <p>Rollos detectados: {planAnalysis.stats.uniqueRollLabels}</p>
                <p>Segmentos: {planAnalysis.stats.rollSegments}</p>
                <p>CHOP: {planAnalysis.stats.choppedSegments}</p>
                <p>SPLIT: {planAnalysis.stats.splitSegments}</p>
                <p>Ft lineales: {planAnalysis.stats.totalLinearFt ?? "-"}</p>
                <p>Promedio ft/rollo: {planAnalysis.stats.avgLinearFtPerRoll ?? "-"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {planAnalysis.detectedRolls.slice(0, 18).map((roll) => (
                  <span
                    key={roll.label}
                    className="rounded-full border border-cyan-700/70 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
                  >
                    {roll.label}
                    {roll.totalLinearFt ? ` · ${roll.totalLinearFt}ft` : ""}
                    {roll.chopCount > 0 ? ` · CH${roll.chopCount}` : ""}
                    {roll.splitCount > 0 ? ` · SP${roll.splitCount}` : ""}
                  </span>
                ))}
                {planAnalysis.detectedRolls.length === 0 ? (
                  <p className="text-xs text-cyan-100/80">Sin rollos detectados automáticamente. Puedes cargar datos manuales.</p>
                ) : null}
              </div>
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
