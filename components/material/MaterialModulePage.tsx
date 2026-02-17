"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, useState } from "react"

import { FieldTypeSelector } from "../../components/shared/FieldTypeSelector"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../types/fieldType"
import { MaterialRecordDb } from "../../types/material"

type MaterialModulePageProps = {
  projectId: string | null
}

type PhotoItem = {
  dataUrl: string
  fileName: string
}

type MaterialLocalRecord = {
  projectId: string
  fieldType: FieldType
  valvula: number
  bolsasEsperadas: number
  observaciones?: string
  fotos: string[]
  timestamp: string
}

function readLocalRecords(storageKey: string): MaterialLocalRecord[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    return JSON.parse(raw) as MaterialLocalRecord[]
  } catch {
    return []
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"))
    reader.readAsDataURL(file)
  })
}

export default function MaterialModulePage({ projectId }: MaterialModulePageProps) {
  const storageKey = `pulse_material_records_${projectId ?? "default"}`

  const [step, setStep] = useState<1 | 2>(1)
  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )

  const [valvula, setValvula] = useState<number | "">("")
  const [bolsasEsperadas, setBolsasEsperadas] = useState<string>("")
  const [observaciones, setObservaciones] = useState("")
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  const [records, setRecords] = useState<MaterialLocalRecord[]>(() => readLocalRecords(storageKey))
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleFieldTypeChange(next: FieldType) {
    if (!projectId) return
    setFieldType(next)
    saveProjectFieldType(projectId, next)
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) return

    setIsUploadingPhotos(true)
    setError("")

    try {
      const nextPhotos: PhotoItem[] = []
      for (const file of selectedFiles) {
        const dataUrl = await readAsDataUrl(file)
        nextPhotos.push({ dataUrl, fileName: file.name })
      }

      setPhotos((prev) => [...prev, ...nextPhotos])
    } catch {
      setError("No se pudieron cargar una o más fotos.")
    } finally {
      setIsUploadingPhotos(false)
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveMaterial(returnToHub: boolean) {
    if (!projectId) return setError("Selecciona proyecto antes de capturar Material.")
    if (!valvula) return setError("Válvula es requerida.")

    const expected = Number(bolsasEsperadas)
    if (!expected || expected <= 0) return setError("Bags expected per pass debe ser mayor a 0.")

    const localRecord: MaterialLocalRecord = {
      projectId,
      fieldType,
      valvula,
      bolsasEsperadas: expected,
      observaciones: observaciones.trim() || undefined,
      fotos: photos.map((photo) => photo.dataUrl),
      timestamp: new Date().toISOString(),
    }

    const nextRecords = [localRecord, ...records]
    setRecords(nextRecords)
    localStorage.setItem(storageKey, JSON.stringify(nextRecords))

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/material-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fieldType,
          tipoMaterial: "Arena",
          tipoPasada: "Sencilla",
          valvula,
          bolsasEsperadas: expected,
          bolsasUtilizadas: expected,
          observaciones,
          fotos: photos.map((photo) => photo.dataUrl),
        }),
      })

      if (!response.ok) throw new Error("Cloud save failed")

      const data = (await response.json()) as MaterialRecordDb
      setSaveMessage(`Guardado en nube. ID: ${data.id}`)
    } catch {
      setSaveMessage("Guardado local (sin conexión a nube).")
    } finally {
      setIsSubmitting(false)
    }

    if (returnToHub) {
      window.location.href = `/capture?project=${encodeURIComponent(projectId)}`
      return
    }

    setValvula("")
    setBolsasEsperadas("")
    setObservaciones("")
    setPhotos([])
    setStep(1)
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar Material.</p>
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
          <p className="text-sm text-neutral-400">Pulse / Material / {projectId}</p>
          <h1 className="text-3xl font-bold">Material</h1>
          <p className="text-neutral-300">Flujo de 2 pasos: Fotos y Cuestionario.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Paso {step} de 2
        </div>

        {step === 1 ? (
          <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">1) Fotos</h2>
            <p className="text-sm text-neutral-400">Sube fotos libres desde galería. No hay mínimo.</p>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
            />

            {photos.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {photos.map((photo, index) => (
                  <div key={`${photo.fileName}-${index}`} className="space-y-2 rounded-xl border border-neutral-700 p-2">
                    <Image
                      src={photo.dataUrl}
                      alt={photo.fileName}
                      width={800}
                      height={500}
                      unoptimized
                      className="h-40 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="w-full rounded-lg border border-neutral-600 px-2 py-1 text-sm hover:bg-neutral-800"
                    >
                      Quitar foto
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">Sin fotos cargadas.</p>
            )}

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={isUploadingPhotos}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              Continue to Material
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">2) Material Questionnaire</h2>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Valve (1-6)</span>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={valvula || 1}
                onChange={(event) => setValvula(Number(event.target.value))}
                className="w-full"
              />
              <p className="text-sm text-neutral-400">Seleccionado: {valvula || 1}</p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Bags expected per pass</span>
              <input
                type="number"
                min={1}
                value={bolsasEsperadas}
                onChange={(event) => setBolsasEsperadas(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Observations (optional)</span>
              <textarea
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void saveMaterial(false)}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Save Material
              </button>
              <button
                type="button"
                onClick={() => void saveMaterial(true)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800 disabled:opacity-50"
              >
                Save & Return to Hub
              </button>
            </div>
          </section>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {saveMessage ? (
          <p className="rounded-xl border border-blue-500/70 bg-blue-500/10 p-3 text-sm text-blue-300">
            {saveMessage}
          </p>
        ) : null}

        {records.length > 0 ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Último registro local</p>
            <pre className="mt-2 overflow-x-auto text-xs text-neutral-200">
              {JSON.stringify(records[0], null, 2)}
            </pre>
          </section>
        ) : null}
      </section>
    </main>
  )
}
