"use client"

export const dynamic = "force-dynamic"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"
import { saveCloudRecord } from "../../../lib/recordClient"

type FieldType = "football" | "soccer" | "beisbol" | "softbol"
type ZoneKey =
  | "lineas"
  | "numeros"
  | "letras"
  | "hashmarks"
  | "logo"
  | "general"
  | "batbox"
  | "coach_base"
  | "pitcher_mound"
  | "linea_corredor"

type PhotoField = "prep" | "antes" | "despues"

type PhotoState = {
  dataUrl: string | null
  fileName: string
}

type PegadaRecord = {
  id: string
  createdAt: string
  fieldType: FieldType
  zone: ZoneKey
  ftTotales: number
  botesUsados: number
  clima: string[]
  condicion: string
  observaciones: string
  photoNames: {
    prep: string
    antes: string
    despues: string
  }
}

const DEFAULT_FIXED_FT = 10

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  football: "Football",
  soccer: "Soccer",
  beisbol: "Beisbol",
  softbol: "Softbol",
}

const ZONE_LABELS: Record<ZoneKey, string> = {
  lineas: "Lineas",
  numeros: "Numeros",
  letras: "Letras",
  hashmarks: "Hashmarks",
  logo: "Logo",
  general: "General",
  batbox: "Bat Box",
  coach_base: "Coach Base",
  pitcher_mound: "Pitcher Mound",
  linea_corredor: "Linea del corredor",
}

const ZONES_BY_FIELD_TYPE: Record<FieldType, ZoneKey[]> = {
  football: ["lineas", "numeros", "letras", "hashmarks", "logo", "general"],
  soccer: ["lineas", "general", "logo", "letras"],
  beisbol: [
    "batbox",
    "lineas",
    "coach_base",
    "pitcher_mound",
    "linea_corredor",
    "logo",
    "letras",
    "general",
  ],
  softbol: [
    "batbox",
    "lineas",
    "coach_base",
    "pitcher_mound",
    "linea_corredor",
    "logo",
    "letras",
    "general",
  ],
}

const CLIMATE_OPTIONS = ["Soleado", "Nublado", "Lluvioso", "Viento", "Humedad alta"]
const CONDITION_OPTIONS = ["Excelente", "Buena", "Regular", "Mala"]

function readStoredFieldType(storageKey: string): FieldType {
  if (typeof window === "undefined") return "football"

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return "football"
    const parsed = JSON.parse(raw) as FieldType
    if (parsed in ZONES_BY_FIELD_TYPE) return parsed
  } catch {
    // fallback
  }

  return "football"
}

function emptyPhoto(): PhotoState {
  return {
    dataUrl: null,
    fileName: "",
  }
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
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")

  const recordsKey = `pulse_pegada_records_${projectId ?? "default"}`
  const fieldTypeKey = `pulse_project_field_type_${projectId ?? "default"}`

  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [fieldType, setFieldType] = useState<FieldType>("football")
  const [zone, setZone] = useState<ZoneKey>("lineas")

  const [prepPhoto, setPrepPhoto] = useState<PhotoState>(emptyPhoto())
  const [antesPhoto, setAntesPhoto] = useState<PhotoState>(emptyPhoto())
  const [despuesPhoto, setDespuesPhoto] = useState<PhotoState>(emptyPhoto())

  const [ftTotales, setFtTotales] = useState<number>(30)
  const [botesUsados, setBotesUsados] = useState<number>(1)
  const [clima, setClima] = useState<string[]>([])
  const [condicion, setCondicion] = useState<string>("")
  const [observaciones, setObservaciones] = useState<string>("")

  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    const storedFieldType = readStoredFieldType(fieldTypeKey)
    setFieldType(storedFieldType)
    setZone(ZONES_BY_FIELD_TYPE[storedFieldType][0])
  }, [fieldTypeKey])

  const zoneOptions = useMemo(() => ZONES_BY_FIELD_TYPE[fieldType], [fieldType])
  const isGeneralZone = zone === "general"

  const hasAllPhotos = useMemo(() => {
    return Boolean(prepPhoto.dataUrl && antesPhoto.dataUrl && despuesPhoto.dataUrl)
  }, [prepPhoto.dataUrl, antesPhoto.dataUrl, despuesPhoto.dataUrl])

  function handleFieldTypeChange(next: FieldType) {
    setFieldType(next)
    setZone(ZONES_BY_FIELD_TYPE[next][0])
    localStorage.setItem(fieldTypeKey, JSON.stringify(next))
    setError("")
  }

  async function handlePhotoChange(field: PhotoField, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingPhoto(true)
    setError("")

    try {
      const dataUrl = await readAsDataUrl(file)
      const nextState: PhotoState = { dataUrl, fileName: file.name }

      if (field === "prep") setPrepPhoto(nextState)
      if (field === "antes") setAntesPhoto(nextState)
      if (field === "despues") setDespuesPhoto(nextState)
    } catch {
      setError("No se pudo cargar esa foto. Intenta de nuevo.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function toggleClimate(option: string) {
    setClima((current) => {
      if (current.includes(option)) return current.filter((item) => item !== option)
      return [...current, option]
    })
  }

  function goToQuestionnaire() {
    if (!hasAllPhotos) {
      setError("Debes subir las 3 fotos para continuar.")
      return
    }

    setError("")
    setStep(2)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!condicion) {
      setError("Selecciona una condición.")
      return
    }

    if (botesUsados <= 0) {
      setError("Botes utilizados debe ser mayor a 0.")
      return
    }

    if (isGeneralZone && ftTotales <= 0) {
      setError("Ft totales debe ser mayor a 0 en zona General.")
      return
    }

    const record: PegadaRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      fieldType,
      zone,
      ftTotales: isGeneralZone ? ftTotales : DEFAULT_FIXED_FT,
      botesUsados,
      clima,
      condicion,
      observaciones,
      photoNames: {
        prep: prepPhoto.fileName,
        antes: antesPhoto.fileName,
        despues: despuesPhoto.fileName,
      },
    }

    const existing = readPegadaRecords(recordsKey)
    localStorage.setItem(recordsKey, JSON.stringify([record, ...existing]))

    if (projectId) {
      try {
        await saveCloudRecord({
          module: "pegada",
          projectId,
          fieldType,
          payload: {
            ...record,
            evidencePhotos: {
              prep: prepPhoto.dataUrl,
              antes: antesPhoto.dataUrl,
              despues: despuesPhoto.dataUrl,
            },
          } as Record<string, unknown>,
        })
        setSaveMessage("Guardado en nube.")
      } catch {
        setSaveMessage("Guardado local (sin conexión a nube).")
      }
    } else {
      setSaveMessage("Captura guardada localmente.")
    }

    setError("")
    setStep(3)
  }

  function resetForm() {
    setPrepPhoto(emptyPhoto())
    setAntesPhoto(emptyPhoto())
    setDespuesPhoto(emptyPhoto())
    setZone(ZONES_BY_FIELD_TYPE[fieldType][0])
    setFtTotales(30)
    setBotesUsados(1)
    setClima([])
    setCondicion("")
    setObservaciones("")
    setSaveMessage("")
    setError("")
    setStep(1)
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
          <h1 className="text-3xl font-bold">Captura de Pegada</h1>
          <p className="text-neutral-300">Flujo simple: fotos, cuestionario y guardado.</p>
        </header>

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

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Paso {step} de 3
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-red-300">{error}</div>
        ) : null}

        {step === 1 ? (
          <section className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">1) Fotos obligatorias</h2>
            <p className="text-sm text-neutral-400">Prep, Antes de Pegado y Después de Pegado.</p>

            <div className="grid gap-4 md:grid-cols-3">
              <PhotoInputCard
                title="Prep"
                photo={prepPhoto}
                onChange={(event) => void handlePhotoChange("prep", event)}
              />
              <PhotoInputCard
                title="Antes de Pegado"
                photo={antesPhoto}
                onChange={(event) => void handlePhotoChange("antes", event)}
              />
              <PhotoInputCard
                title="Después de Pegado"
                photo={despuesPhoto}
                onChange={(event) => void handlePhotoChange("despues", event)}
              />
            </div>

            <button
              type="button"
              onClick={goToQuestionnaire}
              disabled={isReadingPhoto}
              className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              Continuar al cuestionario
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
          >
            <h2 className="text-xl font-semibold">2) Cuestionario</h2>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Zona</span>
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value as ZoneKey)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              >
                {zoneOptions.map((item) => (
                  <option key={item} value={item}>
                    {ZONE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">
                Ft Totales {isGeneralZone ? `(${ftTotales})` : "(fijo por plantilla)"}
              </span>
              <input
                type="range"
                min={1}
                max={500}
                value={ftTotales}
                onChange={(event) => setFtTotales(Number(event.target.value))}
                disabled={!isGeneralZone}
                className="w-full disabled:cursor-not-allowed disabled:opacity-40"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Botes utilizados</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={botesUsados}
                onChange={(event) => setBotesUsados(Number(event.target.value))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              />
            </label>

            <fieldset className="space-y-3">
              <legend className="text-sm text-neutral-300">Clima (selección múltiple)</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CLIMATE_OPTIONS.map((option) => {
                  const checked = clima.includes(option)
                  return (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-700 px-3 py-3"
                    >
                      <span>{option}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleClimate(option)}
                        className="h-5 w-5"
                      />
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Condición</span>
              <select
                value={condicion}
                onChange={(event) => setCondicion(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
              >
                <option value="">Selecciona una condición</option>
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Observaciones</span>
              <textarea
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full rounded-xl border border-neutral-600 px-4 py-4 text-lg font-semibold hover:bg-neutral-800"
              >
                Volver a fotos
              </button>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold hover:bg-emerald-700"
              >
                Guardar captura
              </button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">3) Captura guardada</h2>
            {saveMessage ? (
              <p className="rounded-xl border border-blue-500/70 bg-blue-500/10 p-3 text-blue-300">
                {saveMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-xl bg-neutral-100 px-4 py-4 text-lg font-semibold text-neutral-950 hover:bg-white"
            >
              Nueva captura
            </button>
          </section>
        ) : null}
      </section>
    </main>
  )
}

type PhotoInputCardProps = {
  title: string
  photo: PhotoState
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function PhotoInputCard({ title, photo, onChange }: PhotoInputCardProps) {
  return (
    <label className="block space-y-2 rounded-2xl border border-neutral-700 bg-neutral-950 p-3">
      <span className="font-medium">{title}</span>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        className="block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm"
      />

      <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-neutral-500">
        {photo.dataUrl ? (
          <Image
            src={photo.dataUrl}
            alt={title}
            width={640}
            height={360}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <span>Sin foto</span>
        )}
      </div>
    </label>
  )
}
