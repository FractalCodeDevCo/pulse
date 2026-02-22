"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import ContextHeader from "./ContextHeader"
type CaptureItem = {
  id: string
  module: string
  createdAt: string
  macroZone: string | null
  microZone: string | null
  projectZoneId: string | null
  photos: string[]
  summary: string
}

type ZoneOption = {
  key: string
  macroZone: string
  microZone: string
}

type ApiResponse = {
  captures: CaptureItem[]
  zones: ZoneOption[]
}

type ProjectHistoryClientProps = {
  projectId: string | null
  initialZoneKey?: string | null
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function moduleLabel(module: string): string {
  if (module === "pegada") return "Pegada"
  if (module === "roll_installation") return "Roll Installation"
  if (module === "material") return "Material"
  if (module === "incidence") return "Incidencia"
  if (module === "roll_verification" || module === "roll_verifications") return "Verificación de Rollo"
  if (module === "rollos") return "Rollos"
  if (module === "compactacion") return "Compactación"
  return module
}

function CaptureStoryCard({ capture }: { capture: CaptureItem }) {
  const [index, setIndex] = useState(0)
  const total = capture.photos.length

  useEffect(() => {
    setIndex(0)
  }, [capture.id, total])

  const hasPhotos = total > 0
  const activePhoto = hasPhotos ? capture.photos[index] : null

  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-neutral-400">{formatDate(capture.createdAt)}</p>
          <h3 className="text-lg font-semibold">{moduleLabel(capture.module)}</h3>
          <p className="text-sm text-neutral-300">
            {capture.macroZone ?? "Sin macro"} · {capture.microZone ?? "Sin micro"}
          </p>
        </div>
        <span className="rounded-lg border border-blue-500/60 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
          {capture.summary}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {activePhoto ? (
          <Image
            src={activePhoto}
            alt={`${capture.module}-${capture.id}`}
            width={1200}
            height={800}
            unoptimized
            className="h-72 w-full rounded-xl border border-neutral-700 object-cover"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-950 text-sm text-neutral-400">
            Sin fotos en este registro.
          </div>
        )}

        {hasPhotos ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev - 1 + total) % total)}
              className="rounded-lg border border-neutral-600 px-3 py-2 text-sm font-semibold hover:bg-neutral-800"
            >
              Anterior
            </button>
            <p className="text-xs text-neutral-400">
              Foto {index + 1} de {total}
            </p>
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev + 1) % total)}
              className="rounded-lg border border-neutral-600 px-3 py-2 text-sm font-semibold hover:bg-neutral-800"
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function ProjectHistoryClient({ projectId, initialZoneKey = null }: ProjectHistoryClientProps) {
  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [zoneFilter, setZoneFilter] = useState<string>(initialZoneKey ?? "all")
  const [moduleFilter, setModuleFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!projectId) return

    let cancelled = false
    setLoading(true)
    setError("")

    fetch(`/api/project-captures?project=${encodeURIComponent(projectId)}`)
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse & { error?: string }
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar historial.")
        if (cancelled) return
        setCaptures(data.captures ?? [])
        setZones(data.zones ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "No se pudo cargar historial.")
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  const moduleOptions = useMemo(() => {
    const values = Array.from(new Set(captures.map((item) => item.module)))
    return values.sort((a, b) => a.localeCompare(b))
  }, [captures])

  const filtered = useMemo(() => {
    return captures.filter((capture) => {
      const zoneKey = `${capture.macroZone ?? ""}::${capture.microZone ?? ""}`
      const matchesZone = zoneFilter === "all" || zoneFilter === zoneKey
      const matchesModule = moduleFilter === "all" || moduleFilter === capture.module
      return matchesZone && matchesModule
    })
  }, [captures, moduleFilter, zoneFilter])

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona un proyecto para ver historial.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700">
          Ir a proyectos
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <ContextHeader
          title="Historial de Capturas"
          subtitle="Carrusel de fotos y registros guardados por proyecto y zona."
          backHref={`/pulse?project=${encodeURIComponent(projectId)}`}
          backLabel="Zonas"
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: projectId, href: `/pulse?project=${encodeURIComponent(projectId)}` },
            { label: "Historial" },
          ]}
          projectLabel={projectId}
          statusLabel="Consulta"
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />

        <section className="grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-neutral-300">Filtrar por zona</span>
            <select
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              <option value="all">Todas las zonas</option>
              {zones.map((zone) => (
                <option key={zone.key} value={zone.key}>
                  {zone.macroZone} · {zone.microZone}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-neutral-300">Filtrar por módulo</span>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              <option value="all">Todos los módulos</option>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {moduleLabel(module)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="space-y-3">
          {loading ? <p className="text-sm text-neutral-400">Cargando historial...</p> : null}
          {error ? <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-red-300">{error}</p> : null}

          {!loading && filtered.length === 0 ? (
            <p className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-neutral-300">
              Aún no hay capturas para estos filtros.
            </p>
          ) : null}

          <div className="space-y-4">
            {filtered.map((capture) => (
              <CaptureStoryCard key={`${capture.module}-${capture.id}`} capture={capture} />
            ))}
          </div>
        </section>

        <Link
          href={`/pulse?project=${encodeURIComponent(projectId)}`}
          className="block rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
        >
          Volver a zonas
        </Link>
      </section>
    </main>
  )
}
