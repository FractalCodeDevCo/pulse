"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

import { FIELD_TYPE_LABELS, FieldType, saveProjectFieldType } from "../../types/fieldType"
import {
  AppProject,
  createProject,
  ensureProjectZones,
  MOCK_PROJECTS,
  readLastProjectId,
  readProjectsFromStorage,
  saveLastProject,
  saveProjects,
  slugifyProjectName,
} from "../../lib/projects"

type FlowMode = "new" | "load"

export default function ProjectsPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">Cargando proyectos...</main>}>
      <ProjectsPageContent />
    </Suspense>
  )
}

function ProjectsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const flow = (searchParams.get("flow") === "new" ? "new" : "load") as FlowMode

  const initialProjects = readProjectsFromStorage()
  const defaultProjectId = initialProjects[0]?.id ?? MOCK_PROJECTS[0]?.id ?? ""

  const [projects, setProjects] = useState<AppProject[]>(initialProjects)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => readLastProjectId(defaultProjectId))
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectSport, setNewProjectSport] = useState<FieldType>("football")

  const canContinue = useMemo(() => {
    if (flow === "load") return Boolean(selectedProjectId)
    return Boolean(newProjectName.trim() || selectedProjectId)
  }, [flow, newProjectName, selectedProjectId])

  function continueToZones() {
    if (!canContinue) return

    let targetProject = projects.find((project) => project.id === selectedProjectId) ?? null
    let nextProjects = projects

    if (flow === "new" && newProjectName.trim()) {
      const createdId = slugifyProjectName(newProjectName)
      targetProject = createProject({
        id: createdId,
        name: newProjectName.trim(),
        fieldType: newProjectSport,
      })
      nextProjects = [targetProject, ...projects.filter((project) => project.id !== createdId)]
      setProjects(nextProjects)
    }

    if (!targetProject && selectedProjectId) {
      targetProject = projects.find((project) => project.id === selectedProjectId) ?? null
    }
    if (!targetProject) return

    saveProjects(nextProjects)
    saveLastProject(targetProject.id)
    saveProjectFieldType(targetProject.id, targetProject.fieldType)
    ensureProjectZones(targetProject.id, targetProject.fieldType)

    router.push(`/pulse?project=${encodeURIComponent(targetProject.id)}`)
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-neutral-400">Pulse / Projects</p>
          <h1 className="text-3xl font-bold">{flow === "new" ? "Nuevo proyecto" : "Cargar proyecto"}</h1>
          <p className="text-neutral-300">Configura proyecto y deporte para generar zonas automáticamente.</p>
        </header>

        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Proyectos</span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {FIELD_TYPE_LABELS[project.fieldType]}
                </option>
              ))}
            </select>
          </label>

          {flow === "new" ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm text-neutral-300">Nombre de nuevo proyecto</span>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="Ej: Campo Municipal Norte"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                />
              </label>

              <div className="space-y-2">
                <span className="text-sm text-neutral-300">Deporte</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((item) => {
                    const active = newProjectSport === item
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setNewProjectSport(item)}
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
            </>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="w-full rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
            >
              Volver
            </Link>

            <button
              type="button"
              onClick={continueToZones}
              disabled={!canContinue}
              className={`w-full rounded-xl px-4 py-3 text-center font-semibold ${
                canContinue ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-neutral-700 text-neutral-400"
              }`}
            >
              Continuar a zonas
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}
