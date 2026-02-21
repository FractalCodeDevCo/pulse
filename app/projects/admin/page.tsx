"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"

import { createProject, readProjectsFromStorage, saveProjects, slugifyProjectName } from "../../../lib/projects"
import { FIELD_TYPE_LABELS, FieldType, saveProjectFieldType } from "../../../types/fieldType"

type LocalProject = {
  id: string
  name: string
  fieldType: FieldType
  createdAt: string
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

export default function ProjectsAdminPage() {
  const [projects, setProjects] = useState<LocalProject[]>(() => readProjectsFromStorage())
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [fieldType, setFieldType] = useState<FieldType>("football")
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!name.trim()) {
      setError("Nombre del proyecto es requerido.")
      return
    }

    const nextCode = slugifyProjectName(code.trim() || name.trim())
    if (!nextCode) {
      setError("Código inválido.")
      return
    }

    const nextProject = createProject({
      id: nextCode,
      name: name.trim(),
      fieldType,
    })

    const nextProjects = [nextProject, ...projects.filter((project) => project.id !== nextProject.id)]
    setProjects(nextProjects)
    saveProjects(nextProjects)
    saveProjectFieldType(nextProject.id, nextProject.fieldType)

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: nextProject.id,
          name: nextProject.name,
          fieldType: nextProject.fieldType,
        }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? "No se pudo guardar en nube")
      }

      setMessage("Proyecto guardado en nube y disponible en Nuevo/Cargar proyecto.")
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo guardar en nube"
      setMessage(`Proyecto guardado localmente. Error nube: ${text}`)
    } finally {
      setIsSubmitting(false)
    }

    setName("")
    setCode("")
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-neutral-400">Pulse / Admin</p>
          <h1 className="text-3xl font-bold">Agregar Proyecto Manual</h1>
          <p className="text-neutral-300">Sin password por ahora. Este alta aparece en Nuevo y Cargar proyecto.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Nombre del proyecto</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Proyecto Navidad"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Código (opcional)</span>
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="proyecto-navidad"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm text-neutral-300">Deporte</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((item) => {
                const active = fieldType === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFieldType(item)}
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Guardar proyecto manual
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
                  {project.id} · {FIELD_TYPE_LABELS[project.fieldType]}
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
