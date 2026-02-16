"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { MOCK_PROJECTS, slugifyProjectName } from "../../lib/projects"

type FlowMode = "new" | "load"
type ProjectOption = { id: string; name: string }

const PROJECTS_STORAGE_KEY = "pulse_projects"
const LAST_PROJECT_STORAGE_KEY = "pulse_last_project"

function readProjectsFromStorage(): ProjectOption[] {
  if (typeof window === "undefined") return MOCK_PROJECTS

  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (!raw) return MOCK_PROJECTS
    const parsed = JSON.parse(raw) as ProjectOption[]
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // fallback
  }

  return MOCK_PROJECTS
}

function readLastProjectId(defaultId: string): string {
  if (typeof window === "undefined") return defaultId

  try {
    const raw = localStorage.getItem(LAST_PROJECT_STORAGE_KEY)
    if (!raw) return defaultId
    const parsed = JSON.parse(raw) as string
    return parsed || defaultId
  } catch {
    return defaultId
  }
}

function saveProjects(projects: ProjectOption[]) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
}

function saveLastProject(projectId: string) {
  localStorage.setItem(LAST_PROJECT_STORAGE_KEY, JSON.stringify(projectId))
}

export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const flow = (searchParams.get("flow") === "new" ? "new" : "load") as FlowMode

  const initialProjects = readProjectsFromStorage()
  const defaultProjectId = initialProjects[0]?.id ?? ""

  const [projects, setProjects] = useState<ProjectOption[]>(initialProjects)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() =>
    readLastProjectId(defaultProjectId),
  )
  const [newProjectName, setNewProjectName] = useState("")

  const canContinue = useMemo(() => {
    if (flow === "load") return Boolean(selectedProjectId)
    return Boolean(newProjectName.trim() || selectedProjectId)
  }, [flow, newProjectName, selectedProjectId])

  function continueToCapture() {
    if (!canContinue) return

    let targetProjectId = selectedProjectId

    if (flow === "new" && newProjectName.trim()) {
      const createdId = slugifyProjectName(newProjectName)
      const createdProject = { id: createdId, name: newProjectName.trim() }

      const withoutDuplicate = projects.filter((project) => project.id !== createdId)
      const nextProjects = [createdProject, ...withoutDuplicate]
      setProjects(nextProjects)
      saveProjects(nextProjects)
      targetProjectId = createdId
    } else {
      saveProjects(projects)
    }

    saveLastProject(targetProjectId)
    router.push(`/capture?project=${encodeURIComponent(targetProjectId)}`)
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-neutral-400">Pulse / Projects</p>
          <h1 className="text-3xl font-bold">{flow === "new" ? "Nuevo proyecto" : "Cargar proyecto"}</h1>
          <p className="text-neutral-300">Selecciona un proyecto para abrir sus capturas de obra.</p>
        </header>

        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Proyectos (ficticio por ahora)</span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          {flow === "new" ? (
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Nombre de nuevo proyecto (opcional)</span>
              <input
                type="text"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Ej: Obra Centro"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
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
              onClick={continueToCapture}
              disabled={!canContinue}
              className={`w-full rounded-xl px-4 py-3 text-center font-semibold ${
                canContinue
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "cursor-not-allowed bg-neutral-700 text-neutral-400"
              }`}
            >
              Continuar a módulos
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}
