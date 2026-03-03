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
  metadata: Record<string, unknown>
  editable: boolean
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

const FLOW_PHASE_OPTIONS = [
  "CUTTING",
  "SEWING",
  "ROLL_PLACEMENT",
  "COMPACTION",
  "ADHESIVE",
  "MATERIAL",
] as const

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

type CaptureContextView = {
  capturedAt: string | null
  source: string | null
  latitude: number | null
  longitude: number | null
  accuracyM: number | null
  temperatureC: number | null
  apparentTemperatureC: number | null
  humidityPct: number | null
  windMph: number | null
  weatherLabel: string | null
}

function readCaptureContext(metadata: Record<string, unknown>): CaptureContextView | null {
  const details = asObject(metadata.details)
  const context = asObject(details.captureContext)
  if (Object.keys(context).length === 0) return null

  const location = asObject(context.location)
  const weather = asObject(context.weather)
  const capturedAt = asNullableString(context.capturedAt)

  return {
    capturedAt,
    source: asNullableString(context.source),
    latitude: asNumberOrNull(location.latitude),
    longitude: asNumberOrNull(location.longitude),
    accuracyM: asNumberOrNull(location.accuracyM),
    temperatureC: asNumberOrNull(weather.temperatureC),
    apparentTemperatureC: asNumberOrNull(weather.apparentTemperatureC),
    humidityPct: asNumberOrNull(weather.humidityPct),
    windMph: asNumberOrNull(weather.windMph),
    weatherLabel: asNullableString(weather.weatherLabel),
  }
}

function weatherEmoji(label: string | null): string {
  const text = (label ?? "").toLowerCase()
  if (!text) return "🌡️"
  if (text.includes("clear")) return "☀️"
  if (text.includes("partly")) return "⛅"
  if (text.includes("overcast") || text.includes("cloud")) return "☁️"
  if (text.includes("rain") || text.includes("drizzle")) return "🌧️"
  if (text.includes("thunder")) return "⛈️"
  if (text.includes("snow")) return "❄️"
  if (text.includes("fog")) return "🌫️"
  return "🌡️"
}

function climateBadgeText(context: CaptureContextView): string | null {
  const parts: string[] = []
  if (context.weatherLabel) parts.push(context.weatherLabel)
  if (context.temperatureC !== null) parts.push(`${context.temperatureC.toFixed(1)}°C`)
  if (context.windMph !== null) parts.push(`${context.windMph.toFixed(1)} mph`)
  if (parts.length === 0) return null
  return parts.join(" · ")
}

type CaptureStoryCardProps = {
  capture: CaptureItem
  deleting: boolean
  saving: boolean
  onDelete: (capture: CaptureItem) => void
  onSaveMetadata: (capture: CaptureItem, metadata: Record<string, unknown>) => void
}

function CaptureStoryCard({ capture, deleting, saving, onDelete, onSaveMetadata }: CaptureStoryCardProps) {
  const [index, setIndex] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [editorError, setEditorError] = useState("")
  const [metadataText, setMetadataText] = useState(() => JSON.stringify(capture.metadata ?? {}, null, 2))
  const [flowPhases, setFlowPhases] = useState<string[]>([])
  const [flowQuickNotes, setFlowQuickNotes] = useState("")
  const [flowRollsUsed, setFlowRollsUsed] = useState("")
  const [flowRollLengthFit, setFlowRollLengthFit] = useState("")
  const [flowCompactionMethod, setFlowCompactionMethod] = useState("")
  const [flowRollLabelsCount, setFlowRollLabelsCount] = useState("")
  const [flowTotalSeams, setFlowTotalSeams] = useState("")
  const [flowAdhesiveBotes, setFlowAdhesiveBotes] = useState("")
  const [flowAdhesiveCondicion, setFlowAdhesiveCondicion] = useState("")
  const [flowMaterialTipo, setFlowMaterialTipo] = useState("")
  const [flowMaterialPasada, setFlowMaterialPasada] = useState("")
  const total = capture.photos.length

  useEffect(() => {
    setIndex(0)
  }, [capture.id, total])

  useEffect(() => {
    setMetadataText(JSON.stringify(capture.metadata ?? {}, null, 2))
    const metadata = asObject(capture.metadata)
    const details = asObject(metadata.details)
    const quickNotes = asObject(details.quickNotes)
    const rollPlacement = asObject(details.rollPlacement)
    const sewing = asObject(details.sewing)
    const adhesive = asObject(details.adhesive)
    const material = asObject(details.material)

    setFlowPhases(asStringArray(metadata.phases_completed))
    setFlowQuickNotes(
      Object.entries(quickNotes)
        .map(([key, value]) => `${key}: ${String(value ?? "")}`)
        .join("\n"),
    )
    setFlowRollsUsed(asString(rollPlacement.totalRollsUsed))
    setFlowRollLengthFit(asString(rollPlacement.rollLengthFit))
    setFlowCompactionMethod(asString(rollPlacement.compactionMethod))
    setFlowRollLabelsCount(asString(rollPlacement.rollLabelsCount))
    setFlowTotalSeams(asString(sewing.totalSeams))
    setFlowAdhesiveBotes(asString(adhesive.botesUsados))
    setFlowAdhesiveCondicion(asString(adhesive.condicion))
    setFlowMaterialTipo(asString(material.tipo))
    setFlowMaterialPasada(asString(material.pasada))
    setAdvancedMode(false)
    setEditorError("")
  }, [capture.id, capture.metadata])

  const hasPhotos = total > 0
  const activePhoto = hasPhotos ? capture.photos[index] : null
  const isFlowEditable = capture.editable && capture.module === "flow"
  const captureContext = readCaptureContext(asObject(capture.metadata))
  const climateText = captureContext ? climateBadgeText(captureContext) : null

  function toggleFlowPhase(phase: string) {
    setFlowPhases((current) => {
      if (current.includes(phase)) return current.filter((item) => item !== phase)
      return [...current, phase]
    })
  }

  function buildFlowMetadataPayload(): Record<string, unknown> {
    const current = asObject(capture.metadata)
    const currentDetails = asObject(current.details)

    const quickNotes: Record<string, string> = {}
    const quickNotesLines = flowQuickNotes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    for (const line of quickNotesLines) {
      const [left, ...rest] = line.split(":")
      const key = left?.trim()
      const value = rest.join(":").trim()
      if (!key) continue
      quickNotes[key] = value
    }

    return {
      ...current,
      phases_completed: flowPhases,
      details: {
        ...currentDetails,
        quickNotes,
        rollPlacement: {
          totalRollsUsed: asNullableString(flowRollsUsed),
          rollLengthFit: asNullableString(flowRollLengthFit),
          compactionMethod: asNullableString(flowCompactionMethod),
          rollLabelsCount: asNullableString(flowRollLabelsCount),
        },
        sewing: {
          totalSeams: asNullableString(flowTotalSeams),
        },
        adhesive: {
          botesUsados: asNullableString(flowAdhesiveBotes),
          condicion: asNullableString(flowAdhesiveCondicion),
        },
        material: {
          tipo: asNullableString(flowMaterialTipo),
          pasada: asNullableString(flowMaterialPasada),
        },
      },
    }
  }

  function saveAdvancedJson() {
    let metadata: Record<string, unknown>
    try {
      const parsed = JSON.parse(metadataText) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Metadata debe ser un objeto JSON.")
      }
      metadata = parsed as Record<string, unknown>
      setEditorError("")
    } catch {
      setEditorError("JSON inválido. Revisa formato.")
      return
    }
    onSaveMetadata(capture, metadata)
  }

  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-neutral-400">{formatDate(capture.createdAt)}</p>
          <h3 className="text-lg font-semibold">{moduleLabel(capture.module)}</h3>
          <p className="text-sm text-neutral-300">
            {capture.macroZone ?? "Sin macro"} · {capture.microZone ?? "Sin micro"}
          </p>
          {climateText ? (
            <span className="mt-2 inline-flex rounded-full border border-cyan-500/60 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {weatherEmoji(captureContext?.weatherLabel ?? null)} {climateText}
            </span>
          ) : null}
        </div>
        <span className="rounded-lg border border-blue-500/60 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
          {capture.summary}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="rounded-lg border border-neutral-600 px-3 py-1 text-sm font-semibold hover:bg-neutral-800"
          >
            ...
          </button>
          {showMenu ? (
            <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-neutral-700 bg-neutral-950 p-2">
              <button
                type="button"
                onClick={() => {
                  setEditing((prev) => !prev)
                  setShowMenu(false)
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-800"
              >
                {editing ? "Cerrar detalle" : "Ver/editar datos"}
              </button>
              {isFlowEditable ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdvancedMode((prev) => !prev)
                    setEditing(true)
                    setShowMenu(false)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-800"
                >
                  {advancedMode ? "Modo simple" : "Modo JSON"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  onDelete(capture)
                }}
                disabled={deleting}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting ? "Borrando..." : "Borrar captura"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {captureContext ? (
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-3 text-xs text-cyan-100">
            <p className="font-semibold">Contexto ambiental</p>
            <p className="text-cyan-200/90">
              {captureContext.capturedAt ? `Captura: ${formatDate(captureContext.capturedAt)}` : "Captura: -"}
              {captureContext.temperatureC !== null ? ` · ${captureContext.temperatureC.toFixed(1)}°C` : ""}
              {captureContext.windMph !== null ? ` · Viento ${captureContext.windMph.toFixed(1)} mph` : ""}
              {captureContext.humidityPct !== null ? ` · Humedad ${captureContext.humidityPct.toFixed(0)}%` : ""}
            </p>
            <p className="text-cyan-200/80">
              {captureContext.weatherLabel ? `${captureContext.weatherLabel}` : "Clima: -"}
              {captureContext.apparentTemperatureC !== null ? ` · Sensación ${captureContext.apparentTemperatureC.toFixed(1)}°C` : ""}
              {captureContext.source ? ` · Fuente ${captureContext.source}` : ""}
            </p>
            <p className="text-cyan-200/70">
              {captureContext.latitude !== null && captureContext.longitude !== null
                ? `Ubicación: ${captureContext.latitude.toFixed(5)}, ${captureContext.longitude.toFixed(5)}`
                : "Ubicación: no disponible"}
              {captureContext.accuracyM !== null ? ` · ±${Math.round(captureContext.accuracyM)}m` : ""}
            </p>
          </div>
        ) : null}

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

        {editing ? (
          <div className="space-y-2 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
            {isFlowEditable && !advancedMode ? (
              <>
                <p className="text-xs text-neutral-300">Editor de Flujo (fases y campos clave)</p>
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400">Fases completadas</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {FLOW_PHASE_OPTIONS.map((phase) => {
                      const active = flowPhases.includes(phase)
                      return (
                        <button
                          key={phase}
                          type="button"
                          onClick={() => toggleFlowPhase(phase)}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                            active ? "border-cyan-500 bg-cyan-500/20 text-cyan-100" : "border-neutral-700 text-neutral-300"
                          }`}
                        >
                          {phase}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="text-xs text-neutral-400">Quick Notes (formato: `FASE: nota`, una por línea)</span>
                  <textarea
                    rows={4}
                    value={flowQuickNotes}
                    onChange={(event) => setFlowQuickNotes(event.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                    disabled={saving}
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Rolls Used</span>
                    <input
                      value={flowRollsUsed}
                      onChange={(event) => setFlowRollsUsed(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Roll Length Fit</span>
                    <input
                      value={flowRollLengthFit}
                      onChange={(event) => setFlowRollLengthFit(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Compaction Method</span>
                    <input
                      value={flowCompactionMethod}
                      onChange={(event) => setFlowCompactionMethod(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Roll Labels Count</span>
                    <input
                      value={flowRollLabelsCount}
                      onChange={(event) => setFlowRollLabelsCount(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Total Seams</span>
                    <input
                      value={flowTotalSeams}
                      onChange={(event) => setFlowTotalSeams(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Adhesive Botes</span>
                    <input
                      value={flowAdhesiveBotes}
                      onChange={(event) => setFlowAdhesiveBotes(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Adhesive Condición</span>
                    <input
                      value={flowAdhesiveCondicion}
                      onChange={(event) => setFlowAdhesiveCondicion(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Material Tipo</span>
                    <input
                      value={flowMaterialTipo}
                      onChange={(event) => setFlowMaterialTipo(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-neutral-400">Material Pasada</span>
                    <input
                      value={flowMaterialPasada}
                      onChange={(event) => setFlowMaterialPasada(event.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                      disabled={saving}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-neutral-400">Datos capturados (metadata JSON)</p>
                <textarea
                  rows={8}
                  value={metadataText}
                  onChange={(event) => setMetadataText(event.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs"
                  disabled={!capture.editable || saving}
                />
              </>
            )}
            {!capture.editable ? (
              <p className="text-xs text-amber-300">Este módulo todavía no soporta edición en línea. Solo lectura.</p>
            ) : null}
            {editorError ? <p className="text-xs text-red-300">{editorError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (isFlowEditable && !advancedMode ? onSaveMetadata(capture, buildFlowMetadataPayload()) : saveAdvancedJson())}
                disabled={!capture.editable || saving}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold hover:bg-cyan-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMetadataText(JSON.stringify(capture.metadata ?? {}, null, 2))
                  setEditorError("")
                }}
                className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-semibold hover:bg-neutral-800"
              >
                Revertir
              </button>
            </div>
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
  const [deletingCaptureId, setDeletingCaptureId] = useState<string | null>(null)
  const [savingCaptureId, setSavingCaptureId] = useState<string | null>(null)
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

  async function deleteCapture(capture: CaptureItem) {
    if (!projectId) return
    const confirmed = window.confirm("¿Borrar esta captura? Esta acción no se puede deshacer.")
    if (!confirmed) return

    setDeletingCaptureId(capture.id)
    setError("")
    try {
      const response = await fetch("/api/project-captures", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          id: capture.id,
          module: capture.module,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "No se pudo borrar captura.")

      setCaptures((current) => current.filter((item) => !(item.id === capture.id && item.module === capture.module)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar captura.")
    } finally {
      setDeletingCaptureId(null)
    }
  }

  async function saveCaptureMetadata(capture: CaptureItem, metadata: Record<string, unknown>) {
    if (!projectId || !capture.editable) return

    setSavingCaptureId(capture.id)
    setError("")
    try {
      const response = await fetch("/api/project-captures", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          id: capture.id,
          module: capture.module,
          metadata,
        }),
      })
      const data = (await response.json()) as { error?: string; metadata?: Record<string, unknown> }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar cambios.")

      setCaptures((current) =>
        current.map((item) =>
          item.id === capture.id && item.module === capture.module
            ? {
                ...item,
                metadata: data.metadata ?? metadata,
              }
            : item,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar cambios.")
    } finally {
      setSavingCaptureId(null)
    }
  }

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
              <CaptureStoryCard
                key={`${capture.module}-${capture.id}`}
                capture={capture}
                deleting={deletingCaptureId === capture.id}
                saving={savingCaptureId === capture.id}
                onDelete={deleteCapture}
                onSaveMetadata={saveCaptureMetadata}
              />
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
