"use client"

export const dynamic = "force-dynamic"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChangeEvent, Suspense, useMemo, useState } from "react"

import ContextHeader from "../../../components/pulse/ContextHeader"
import { IMAGE_INPUT_ACCEPT, processImageFiles } from "../../../lib/clientImage"
import { FIELD_TYPE_LABELS, FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"
import { MacroZone, getMacroZoneOptions, getMicroZoneOptions } from "../../../types/zoneHierarchy"

const INCIDENT_OPTIONS = [
  "Longitud de rollo incorrecta",
  "Costura mal alineada",
  "Retrabajo por costura",
  "Retraso de maquinaria",
  "Pegado deficiente",
  "Material incorrecto",
  "Compactación insuficiente",
  "Otro",
] as const

const IMPACT_OPTIONS = ["Sin impacto", "Ajuste menor", "Retraso moderado", "Retraso fuerte"] as const

export default function IncidenciasPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">Cargando Incidencias...</main>}>
      <IncidenciasPageContent />
    </Suspense>
  )
}

function IncidenciasPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  const projectZoneId = searchParams.get("projectZoneId")
  const presetMacroZone = searchParams.get("macroZone")
  const presetMicroZone = searchParams.get("microZone")
  const presetZoneType = searchParams.get("zoneType")

  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )
  const [typeOfIncidence, setTypeOfIncidence] = useState<string>("")
  const [macroZone, setMacroZone] = useState<MacroZone | "">((presetMacroZone as MacroZone | null) ?? "")
  const [microZone, setMicroZone] = useState(presetMicroZone ?? "")
  const [impactLevel, setImpactLevel] = useState<string>("")
  const [note, setNote] = useState("")
  const [photos, setPhotos] = useState<string[]>([])

  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")
  const backToZoneOrHub =
    projectId && projectZoneId
      ? `/pulse/zones/${encodeURIComponent(projectZoneId)}?project=${encodeURIComponent(projectId)}`
      : `/pulse?project=${encodeURIComponent(projectId ?? "")}`

  const microOptions = useMemo(() => {
    if (!macroZone) return []
    return getMicroZoneOptions(fieldType, macroZone)
  }, [fieldType, macroZone])
  const macroZoneOptions = useMemo(() => getMacroZoneOptions(fieldType), [fieldType])

  async function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError("")
    setIsReadingPhoto(true)

    try {
      const urls = await processImageFiles(Array.from(files))
      setPhotos((prev) => [...prev, ...urls].slice(0, 3))
    } catch {
      setError("No pudimos cargar las fotos.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveIncidence(returnToHub: boolean) {
    if (!projectId) return setError("Selecciona proyecto antes de capturar incidencias.")
    if (!typeOfIncidence) return setError("Tipo de incidencia es requerido.")
    if (!macroZone) return setError("MacroZone es requerida.")
    if (!microZone) return setError("MicroZone es requerida.")
    if (!impactLevel) return setError("Prioridad/impacto es requerido.")
    if (photos.length < 1 || photos.length > 3) return setError("Debes subir entre 1 y 3 fotos.")

    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/incidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          field_type: fieldType,
          macro_zone: macroZone,
          micro_zone: microZone,
          type_of_incidence: typeOfIncidence,
          impact_level: impactLevel,
          priority_level: impactLevel,
          project_zone_id: projectZoneId,
          zone_type: presetZoneType,
          photos,
          note: note.trim(),
          timestamp: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Incidence save failed")
      }

      console.log("[incidence] save_success", { id: data.id, projectId })
      setSaveMessage("Incidencia guardada en nube.")

      if (returnToHub) {
        window.location.href = backToZoneOrHub
        return
      }

      setTypeOfIncidence("")
      setMacroZone("")
      setMicroZone("")
      setImpactLevel("")
      setNote("")
      setPhotos([])
    } catch (err) {
      console.error("[incidence] save_failed", {
        projectId,
        error: err instanceof Error ? err.message : "unknown_error",
      })
      setError("Error al guardar incidencia en nube.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleFieldTypeChange(next: FieldType) {
    if (projectId) saveProjectFieldType(projectId, next)
    setFieldType(next)
    setMacroZone("")
    setMicroZone("")
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar incidencias.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold">
          Ir a proyectos
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <ContextHeader
          title="Bitácora de Incidencias"
          subtitle="Registro estandarizado de incidencias por zona."
          backHref={backToZoneOrHub}
          backLabel={projectZoneId ? "Zona" : "Proyecto"}
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: projectId, href: `/pulse?project=${encodeURIComponent(projectId)}` },
            { label: "Incidencias" },
          ]}
          projectLabel={projectId}
          zoneLabel={macroZone && microZone ? `${macroZone} / ${microZone}` : null}
          statusLabel={isSubmitting ? "Guardando..." : "En captura"}
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Tipo de campo (por proyecto)</p>
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
        </section>

        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Tipo de Incidencia</span>
            <select
              value={typeOfIncidence}
              onChange={(event) => setTypeOfIncidence(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              <option value="">Selecciona tipo</option>
              {INCIDENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">MacroZone</span>
            <select
              value={macroZone}
              onChange={(event) => {
                setMacroZone(event.target.value as MacroZone | "")
                setMicroZone("")
              }}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              <option value="">Selecciona MacroZone</option>
              {macroZoneOptions.map((macro) => (
                <option key={macro.value} value={macro.value}>
                  {macro.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">MicroZone</span>
            <select
              value={microZone}
              onChange={(event) => setMicroZone(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              disabled={!macroZone}
            >
              <option value="">Selecciona MicroZone</option>
              {microOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Prioridad / impacto</span>
            <select
              value={impactLevel}
              onChange={(event) => setImpactLevel(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              <option value="">Selecciona impacto</option>
              {IMPACT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Fotos (1–3)</span>
            <input
              type="file"
              accept={IMAGE_INPUT_ACCEPT}
              multiple
              onChange={handlePhotosChange}
              className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
            />
          </label>

          {photos.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {photos.map((photo, index) => (
                <div key={`${photo}-${index}`} className="space-y-2">
                  <Image
                    src={photo}
                    alt={`Incidencia ${index + 1}`}
                    width={600}
                    height={400}
                    unoptimized
                    className="h-36 w-full rounded-xl border border-neutral-700 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="w-full rounded-lg border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
          ) : null}
          {saveMessage ? (
            <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {saveMessage}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => void saveIncidence(false)}
              disabled={isSubmitting || isReadingPhoto}
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Save Incidencia
            </button>
            <button
              type="button"
              onClick={() => void saveIncidence(true)}
              disabled={isSubmitting || isReadingPhoto}
              className="rounded-xl border border-blue-500 px-4 py-3 font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
            >
              {projectZoneId ? "Save & Return Zone" : "Save & Return Hub"}
            </button>
            <Link
              href={backToZoneOrHub}
              className="rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
            >
              Cancelar
            </Link>
          </div>
        </section>
      </section>
    </main>
  )
}
