"use client"

export const dynamic = "force-dynamic"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChangeEvent, Suspense, useMemo, useState } from "react"

import { FieldTypeSelector } from "../../../components/shared/FieldTypeSelector"
import { saveCloudRecord } from "../../../lib/recordClient"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"
import { Zone } from "../../../types/zones"

type PhotoItem = { dataUrl: string; fileName: string }
type PegadaPhaseStatus = "IN_PROGRESS" | "COMPLETED"

type PegadaRecord = {
  id: string
  projectId: string
  fieldType: FieldType
  zone: Zone
  phaseStatus: PegadaPhaseStatus
  observations?: string
  photos: string[]
  timestamp: string
}

function parseZone(zoneValue: string | null): Zone | "" {
  if (!zoneValue) return ""
  const upper = zoneValue.toUpperCase()
  if (upper in Zone) return Zone[upper as keyof typeof Zone]
  return ""
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("No se pudo leer la foto"))
    reader.readAsDataURL(file)
  })
}

function readPegadaRecords(storageKey: string): PegadaRecord[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    return JSON.parse(raw) as PegadaRecord[]
  } catch {
    return []
  }
}

export default function PegadaPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">Cargando Pegada...</main>}>
      <PegadaPageContent />
    </Suspense>
  )
}

function PegadaPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  const defaultZone = parseZone(searchParams.get("zone"))

  const recordsKey = `pulse_pegada_records_${projectId ?? "default"}`
  const [step, setStep] = useState<1 | 2>(1)
  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )
  const [zone, setZone] = useState<Zone | "">(defaultZone || "")
  const [phaseStatus, setPhaseStatus] = useState<PegadaPhaseStatus | "">("")
  const [observations, setObservations] = useState("")
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")

  const canContinue = photos.length >= 3

  const photoUrls = useMemo(() => photos.map((photo) => photo.dataUrl), [photos])

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) return

    setError("")
    setIsReadingPhoto(true)

    try {
      const next: PhotoItem[] = []
      for (const file of selectedFiles) {
        next.push({ dataUrl: await readAsDataUrl(file), fileName: file.name })
      }
      setPhotos((prev) => [...prev, ...next])
    } catch {
      setError("No se pudo cargar una o más fotos.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= photos.length) return
    const next = [...photos]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setPhotos(next)
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFieldTypeChange(next: FieldType) {
    if (!projectId) return
    setFieldType(next)
    saveProjectFieldType(projectId, next)
  }

  async function savePegada(returnToHub: boolean) {
    if (!projectId) return setError("Selecciona proyecto antes de capturar Pegada.")
    if (!zone) return setError("Zona requerida.")
    if (!phaseStatus) return setError("Phase Status requerido.")
    if (photos.length < 3) return setError("Mínimo 3 fotos requeridas.")

    const record: PegadaRecord = {
      id: crypto.randomUUID(),
      projectId,
      fieldType,
      zone: zone as Zone,
      phaseStatus: phaseStatus as PegadaPhaseStatus,
      observations: observations.trim() || undefined,
      photos: photoUrls,
      timestamp: new Date().toISOString(),
    }

    const existing = readPegadaRecords(recordsKey)
    localStorage.setItem(recordsKey, JSON.stringify([record, ...existing]))

    setIsSubmitting(true)
    setError("")

    try {
      await saveCloudRecord({
        module: "pegada",
        projectId,
        fieldType,
        payload: record as unknown as Record<string, unknown>,
      })
      setSaveMessage("Guardado en nube.")
    } catch {
      setSaveMessage("Guardado local (sin conexión a nube).")
    } finally {
      setIsSubmitting(false)
    }

    if (returnToHub) {
      window.location.href = `/capture?project=${encodeURIComponent(projectId)}`
      return
    }

    setStep(1)
    setZone(defaultZone || "")
    setPhaseStatus("")
    setObservations("")
    setPhotos([])
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar Pegada.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold">
          Ir a proyectos
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-neutral-400">Pulse / Pegada / {projectId}</p>
          <h1 className="text-3xl font-bold">Pegada</h1>
          <p className="text-neutral-300">2 pasos: Fotos y Cuestionario.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Paso {step} de 2
        </div>

        {error ? <div className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-red-300">{error}</div> : null}

        {step === 1 ? (
          <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">1) Fotos</h2>
            <p className="text-sm text-neutral-400">Mínimo 3 fotos requeridas. Puedes agregar más.</p>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
            />

            {photos.length > 0 ? (
              <div className="space-y-3">
                {photos.map((photo, index) => (
                  <div key={`${photo.fileName}-${index}`} className="rounded-xl border border-neutral-700 p-3">
                    <Image
                      src={photo.dataUrl}
                      alt={photo.fileName}
                      width={1200}
                      height={700}
                      unoptimized
                      className="h-60 w-full rounded-lg object-cover"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => movePhoto(index, -1)} className="rounded-lg border border-neutral-600 px-2 py-1 text-sm hover:bg-neutral-800">Subir</button>
                      <button type="button" onClick={() => movePhoto(index, 1)} className="rounded-lg border border-neutral-600 px-2 py-1 text-sm hover:bg-neutral-800">Bajar</button>
                      <button type="button" onClick={() => removePhoto(index)} className="rounded-lg border border-neutral-600 px-2 py-1 text-sm hover:bg-neutral-800">Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canContinue || isReadingPhoto}
              className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              Continue to Pegada
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">2) Pegada Questionnaire</h2>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Zone</span>
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value as Zone | "")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              >
                <option value="">Select zone</option>
                <option value={Zone.CENTRAL}>Central</option>
                <option value={Zone.SIDELINE_RIGHT}>Sideline Derecho</option>
                <option value={Zone.SIDELINE_LEFT}>Sideline Izquierdo</option>
                <option value={Zone.CABECERAS}>Cabeceras</option>
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm text-neutral-300">Phase Status</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "IN_PROGRESS", label: "IN_PROGRESS" },
                  { value: "COMPLETED", label: "COMPLETED" },
                ].map((item) => {
                  const active = phaseStatus === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPhaseStatus(item.value as PegadaPhaseStatus)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                        active ? "border-blue-500 bg-blue-500/20 text-blue-200" : "border-neutral-700 bg-neutral-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Observations (optional)</span>
              <textarea
                rows={3}
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void savePegada(false)}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Save Pegada
              </button>
              <button
                type="button"
                onClick={() => void savePegada(true)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800 disabled:opacity-50"
              >
                Save & Return to Hub
              </button>
            </div>
          </section>
        ) : null}

        {saveMessage ? (
          <div className="rounded-xl border border-blue-500/70 bg-blue-500/10 p-3 text-blue-300">{saveMessage}</div>
        ) : null}
      </section>
    </main>
  )
}
