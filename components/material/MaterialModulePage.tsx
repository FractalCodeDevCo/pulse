"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, FormEvent, useMemo, useState } from "react"

import { FieldTypeSelector } from "../../components/shared/FieldTypeSelector"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../types/fieldType"
import { MaterialKind, MaterialRecordDb, PassType, StatusColor } from "../../types/material"

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
  tipoMaterial: MaterialKind
  tipoPasada: PassType
  valvula: number
  bolsasEsperadas: number
  bolsasUtilizadas: number
  desviacion: number
  statusColor: StatusColor
  sugerencia: string
  fotos: string[]
  observaciones?: string
  timestamp: string
}

const MATERIAL_OPTIONS: MaterialKind[] = ["Arena", "Goma"]
const PASS_OPTIONS: PassType[] = ["Sencilla", "Doble"]
const VALVE_OPTIONS = [1, 2, 3, 4, 5]

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

function getStatusColor(desviacion: number): StatusColor {
  const abs = Math.abs(desviacion)
  if (abs <= 5) return "verde"
  if (abs <= 12) return "amarillo"
  return "rojo"
}

function getSuggestion(desviacion: number, statusColor: StatusColor): string {
  if (statusColor !== "rojo") return ""
  if (desviacion > 0) return "Revisar válvula. Posible ajuste a nivel inferior."
  if (desviacion < 0) return "Revisar válvula. Posible ajuste a nivel superior."
  return ""
}

function getStatusStyles(statusColor: StatusColor): string {
  if (statusColor === "verde") return "border-emerald-500 bg-emerald-500/15 text-emerald-200"
  if (statusColor === "amarillo") return "border-amber-500 bg-amber-500/15 text-amber-200"
  return "border-red-500 bg-red-500/15 text-red-200"
}

export default function MaterialModulePage({ projectId }: MaterialModulePageProps) {
  const storageKey = `pulse_material_records_${projectId ?? "default"}`

  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )
  const [tipoMaterial, setTipoMaterial] = useState<MaterialKind | "">("")
  const [tipoPasada, setTipoPasada] = useState<PassType | "">("")
  const [valvula, setValvula] = useState<number | "">("")
  const [bolsasEsperadas, setBolsasEsperadas] = useState<string>("")
  const [bolsasUtilizadas, setBolsasUtilizadas] = useState<string>("")
  const [observaciones, setObservaciones] = useState("")
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  const [records, setRecords] = useState<MaterialLocalRecord[]>(() => readLocalRecords(storageKey))
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const expected = Number(bolsasEsperadas)
  const used = Number(bolsasUtilizadas)

  const hasValidDeviation = expected > 0 && used > 0
  const desviacion = hasValidDeviation ? ((used - expected) / expected) * 100 : 0
  const statusColor = getStatusColor(desviacion)
  const sugerencia = getSuggestion(desviacion, statusColor)

  const statusLabel = useMemo(() => {
    if (statusColor === "verde") return "Verde"
    if (statusColor === "amarillo") return "Amarillo"
    return "Rojo"
  }, [statusColor])

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!projectId) return setError("Selecciona proyecto antes de capturar Material.")
    if (!tipoMaterial) return setError("Tipo de material es requerido.")
    if (!tipoPasada) return setError("Tipo de pasada es requerido.")
    if (!valvula) return setError("Número de válvula es requerido.")
    if (!expected || expected <= 0) return setError("Bolsas esperadas debe ser mayor a 0.")
    if (!used || used <= 0) return setError("Bolsas utilizadas debe ser mayor a 0.")
    if (photos.length < 1) return setError("Debes subir mínimo 1 foto de evidencia.")

    const localRecord: MaterialLocalRecord = {
      projectId,
      fieldType,
      tipoMaterial,
      tipoPasada,
      valvula,
      bolsasEsperadas: expected,
      bolsasUtilizadas: used,
      desviacion,
      statusColor,
      sugerencia,
      fotos: photos.map((photo) => photo.dataUrl),
      observaciones: observaciones.trim() || undefined,
      timestamp: new Date().toISOString(),
    }

    // Local backup first, so field work never loses data.
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
          tipoMaterial,
          tipoPasada,
          valvula,
          bolsasEsperadas: expected,
          bolsasUtilizadas: used,
          observaciones,
          fotos: photos.map((photo) => photo.dataUrl),
        }),
      })

      if (!response.ok) {
        throw new Error("Cloud save failed")
      }

      const data = (await response.json()) as MaterialRecordDb
      setSaveMessage(`Guardado en nube. ID: ${data.id}`)
    } catch {
      setSaveMessage("Guardado local (sin conexión a nube).")
    } finally {
      setIsSubmitting(false)
    }

    setTipoMaterial("")
    setTipoPasada("")
    setValvula("")
    setBolsasEsperadas("")
    setBolsasUtilizadas("")
    setObservaciones("")
    setPhotos([])
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
          <p className="text-neutral-300">Registro de pasadas de arena y goma por obra.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1) Configuración de pasada</h2>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Tipo de material</span>
              <select
                value={tipoMaterial}
                onChange={(event) => setTipoMaterial(event.target.value as MaterialKind | "")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              >
                <option value="">Selecciona material</option>
                {MATERIAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Tipo de pasada</span>
              <select
                value={tipoPasada}
                onChange={(event) => setTipoPasada(event.target.value as PassType | "")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              >
                <option value="">Selecciona pasada</option>
                {PASS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Número de válvula</span>
              <select
                value={valvula}
                onChange={(event) => setValvula(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              >
                <option value="">Selecciona válvula</option>
                {VALVE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2) Control de bolsas</h2>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Bolsas esperadas</span>
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
              <span className="text-sm text-neutral-300">Bolsas utilizadas</span>
              <input
                type="number"
                min={1}
                value={bolsasUtilizadas}
                onChange={(event) => setBolsasUtilizadas(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              />
            </label>

            {hasValidDeviation ? (
              <div className={`rounded-xl border p-4 ${getStatusStyles(statusColor)}`}>
                <p className="text-sm">Desviación: {desviacion.toFixed(2)}%</p>
                <p className="text-2xl font-bold uppercase">{statusLabel}</p>
              </div>
            ) : null}
          </section>

          {hasValidDeviation && sugerencia ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">3) Sugerencia sutil de válvula</h2>
              <p className="rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-neutral-300">
                {sugerencia}
              </p>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4) Evidencia fotográfica</h2>
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Fotos de la capa aplicada (mínimo 1)</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoChange}
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
              />
            </label>

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
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5) Observaciones</h2>
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              placeholder="Notas opcionales de la pasada"
            />
          </section>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isUploadingPhotos || isSubmitting}
            className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            SUBMIT
          </button>
        </form>

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
