"use client"

export const dynamic = "force-dynamic"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react"

import ContextHeader from "../../../components/pulse/ContextHeader"
import { createCaptureSessionId } from "../../../lib/captureSession"
import { clearCaptureDraft, readCaptureDraft, saveCaptureDraft } from "../../../lib/captureDraft"
import { IMAGE_INPUT_ACCEPT, processImageFile } from "../../../lib/clientImage"
import { saveCloudRecord } from "../../../lib/recordClient"
import { readZonePhotosCache } from "../../../lib/zonePhotoCache"
import { FIELD_TYPE_LABELS, FieldType } from "../../../types/fieldType"
import { MacroZone, getMacroZoneOptions, getMicroZoneOptions } from "../../../types/zoneHierarchy"

type PhotoField = "prep" | "antes" | "despues"

type PhotoState = {
  dataUrl: string | null
  fileName: string
}

type PegadaRecord = {
  id: string
  createdAt: string
  fieldType: FieldType
  zone: string
  macro_zone: MacroZone
  micro_zone: string
  critical_infield_area?: string
  critical_infield_areas?: string[]
  markbox?: string
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

type PegadaSummary = {
  module: "pegada"
  traffic_light: "green" | "yellow" | "red"
  ratio_to_baseline: number
  r_cans_per_ft: number
  baseline_mu: number
  baseline_mu_next: number
  predicted_cans: number
  savings_usd: number
  can_price_usd: number
  zone_type: string
}

type PegadaDraft = {
  step: 1 | 2
  fieldType: FieldType
  macroZone: MacroZone | ""
  microZone: string
  prepPhoto: PhotoState
  antesPhoto: PhotoState
  despuesPhoto: PhotoState
  ftTotales: number
  botesUsados: number
  criticalInfieldAreas: string[]
  lineasMarkbox: boolean
  clima: string[]
  condicion: string
  observaciones: string
  captureSessionId: string
}

const DEFAULT_FIXED_FT = 10

const CLIMATE_OPTIONS = ["Soleado", "Nublado", "Lluvioso", "Viento", "Humedad alta"]
const CONDITION_OPTIONS = ["Excelente", "Buena", "Regular", "Mala"]
const BEIS_SOFT_CRITICAL_AREAS = [
  "Batter Box",
  "Pitcher Mound",
  "Coach Zones",
  "Línea del corredor",
] as const
const LINEAS_MARKBOX = "Lineas"

function readStoredFieldType(storageKey: string): FieldType {
  if (typeof window === "undefined") return "football"

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return "football"
    const parsed = JSON.parse(raw) as FieldType
    if (parsed in FIELD_TYPE_LABELS) return parsed
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
  const projectZoneId = searchParams.get("projectZoneId")
  const presetMacroZone = searchParams.get("macroZone")
  const presetMicroZone = searchParams.get("microZone")
  const presetZoneType = searchParams.get("zoneType")
  const prefillFromZone = searchParams.get("prefill") === "1"

  const fieldTypeKey = `pulse_project_field_type_${projectId ?? "default"}`

  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [fieldType, setFieldType] = useState<FieldType>("football")
  const [macroZone, setMacroZone] = useState<MacroZone | "">((presetMacroZone as MacroZone | null) ?? "")
  const [microZone, setMicroZone] = useState(presetMicroZone ?? "")

  const [prepPhoto, setPrepPhoto] = useState<PhotoState>(emptyPhoto())
  const [antesPhoto, setAntesPhoto] = useState<PhotoState>(emptyPhoto())
  const [despuesPhoto, setDespuesPhoto] = useState<PhotoState>(emptyPhoto())

  const [ftTotales, setFtTotales] = useState<number>(30)
  const [botesUsados, setBotesUsados] = useState<number>(1)
  const [criticalInfieldAreas, setCriticalInfieldAreas] = useState<string[]>([])
  const [lineasMarkbox, setLineasMarkbox] = useState(false)
  const [clima, setClima] = useState<string[]>([])
  const [condicion, setCondicion] = useState<string>("")
  const [observaciones, setObservaciones] = useState<string>("")
  const [captureSessionId, setCaptureSessionId] = useState(() => createCaptureSessionId())

  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")
  const [summary, setSummary] = useState<PegadaSummary | null>(null)
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftRecovered, setDraftRecovered] = useState(false)
  const draftKey = useMemo(
    () => (projectId ? `pulse_draft_pegada_${projectId}_${projectZoneId ?? "global"}` : null),
    [projectId, projectZoneId],
  )
  const backToZoneOrHub =
    projectId && projectZoneId
      ? `/pulse/zones/${encodeURIComponent(projectZoneId)}?project=${encodeURIComponent(projectId)}`
      : `/pulse?project=${encodeURIComponent(projectId ?? "")}`

  useEffect(() => {
    const storedFieldType = readStoredFieldType(fieldTypeKey)
    setFieldType(storedFieldType)
  }, [fieldTypeKey])

  useEffect(() => {
    if (!draftKey) return
    const draft = readCaptureDraft<PegadaDraft>(draftKey)
    if (draft) {
      setStep(draft.step)
      setFieldType(draft.fieldType)
      setMacroZone(draft.macroZone)
      setMicroZone(draft.microZone)
      setPrepPhoto(draft.prepPhoto)
      setAntesPhoto(draft.antesPhoto)
      setDespuesPhoto(draft.despuesPhoto)
      setFtTotales(draft.ftTotales)
      setBotesUsados(draft.botesUsados)
      setCriticalInfieldAreas(draft.criticalInfieldAreas)
      setLineasMarkbox(draft.lineasMarkbox)
      setClima(draft.clima)
      setCondicion(draft.condicion)
      setObservaciones(draft.observaciones)
      setCaptureSessionId(draft.captureSessionId || createCaptureSessionId())
      setDraftRecovered(true)
    }
    setDraftReady(true)
  }, [draftKey])

  useEffect(() => {
    if (prefillApplied) return
    if (!draftReady || draftRecovered) return
    if (!prefillFromZone || !projectId || !projectZoneId) return

    const cached = readZonePhotosCache(projectId, projectZoneId)
    setPrefillApplied(true)

    if (cached.length < 1) {
      setError("No encontramos fotos de zona en caché. Vuelve a Paso 1 de la zona y sube fotos.")
      return
    }

    setPrepPhoto({ dataUrl: cached[0] ?? null, fileName: "prep-zone.jpg" })
    setAntesPhoto({ dataUrl: cached[1] ?? null, fileName: "antes-zone.jpg" })
    setDespuesPhoto({ dataUrl: cached[2] ?? null, fileName: "despues-zone.jpg" })
    setStep(2)
    setError("")
  }, [draftReady, draftRecovered, prefillApplied, prefillFromZone, projectId, projectZoneId])

  useEffect(() => {
    if (!draftReady || !draftKey) return
    if (step === 3) return

    const hasMeaningfulDraft = Boolean(
      prepPhoto.dataUrl ||
        antesPhoto.dataUrl ||
        despuesPhoto.dataUrl ||
        macroZone ||
        microZone ||
        criticalInfieldAreas.length > 0 ||
        lineasMarkbox ||
        clima.length > 0 ||
        condicion ||
        observaciones.trim().length > 0 ||
        ftTotales !== 30 ||
        botesUsados !== 1 ||
        step === 2,
    )

    if (!hasMeaningfulDraft) {
      clearCaptureDraft(draftKey)
      return
    }

    saveCaptureDraft<PegadaDraft>(draftKey, {
      step: step > 2 ? 2 : step,
      fieldType,
      macroZone,
      microZone,
      prepPhoto,
      antesPhoto,
      despuesPhoto,
      ftTotales,
      botesUsados,
      criticalInfieldAreas,
      lineasMarkbox,
      clima,
      condicion,
      observaciones,
      captureSessionId,
    })
  }, [
    antesPhoto,
    botesUsados,
    captureSessionId,
    clima,
    condicion,
    criticalInfieldAreas,
    despuesPhoto,
    draftKey,
    draftReady,
    fieldType,
    ftTotales,
    lineasMarkbox,
    macroZone,
    microZone,
    observaciones,
    prepPhoto,
    step,
  ])

  const microZoneOptions = useMemo(() => {
    if (!macroZone) return []
    return getMicroZoneOptions(fieldType, macroZone)
  }, [fieldType, macroZone])
  const macroZoneOptions = useMemo(() => getMacroZoneOptions(fieldType), [fieldType])

  const isBeisSoft = fieldType === "beisbol" || fieldType === "softbol"
  const isBeisSoftInfield = isBeisSoft && macroZone === "Infield"
  const isCriticalInfieldSelection = isBeisSoftInfield && criticalInfieldAreas.length > 0
  const canShowLineasMarkbox =
    fieldType === "soccer" || fieldType === "football" || fieldType === "beisbol" || fieldType === "softbol"

  const totalSteps = prefillFromZone ? 2 : 3
  const displayStep = prefillFromZone ? (step === 3 ? 2 : step) : step

  function handleFieldTypeChange(next: FieldType) {
    setFieldType(next)
    localStorage.setItem(fieldTypeKey, JSON.stringify(next))
    setMacroZone("")
    setMicroZone("")
    setCriticalInfieldAreas([])
    setLineasMarkbox(false)
    setError("")
  }

  function toggleCriticalInfieldArea(item: string) {
    setCriticalInfieldAreas((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item)
      return [...current, item]
    })
  }

  async function handlePhotoChange(field: PhotoField, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingPhoto(true)
    setError("")

    try {
      const dataUrl = await processImageFile(file)
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
    setError("")
    setStep(2)
  }

  async function savePegada(returnToHub: boolean) {
    if (!macroZone) {
      setError("MacroZone es requerida.")
      return false
    }

    if (!microZone) {
      setError("MicroZone es requerida.")
      return false
    }

    if (!condicion) {
      setError("Selecciona una condición.")
      return false
    }

    if (botesUsados <= 0) {
      setError("Botes utilizados debe ser mayor a 0.")
      return false
    }

    if (!isCriticalInfieldSelection && ftTotales <= 0) {
      setError("Ft totales debe ser mayor a 0.")
      return false
    }

    const record: PegadaRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      fieldType,
      zone: microZone,
      macro_zone: macroZone,
      micro_zone: microZone,
      critical_infield_area: isCriticalInfieldSelection ? criticalInfieldAreas[0] : undefined,
      critical_infield_areas: isCriticalInfieldSelection ? criticalInfieldAreas : undefined,
      markbox: lineasMarkbox ? LINEAS_MARKBOX : undefined,
      ftTotales: isCriticalInfieldSelection ? DEFAULT_FIXED_FT : ftTotales,
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

    if (projectId) {
      setSummary(null)
      try {
        const response = await saveCloudRecord({
          module: "pegada",
          projectId,
          fieldType,
          payload: {
            ...record,
            project_zone_id: projectZoneId,
            zone_type: presetZoneType,
            capture_session_id: captureSessionId,
            capture_status: "complete",
            evidencePhotos: {
              prep: prepPhoto.dataUrl,
              antes: antesPhoto.dataUrl,
              despues: despuesPhoto.dataUrl,
            },
          } as Record<string, unknown>,
        })
        console.log("[pegada] save_success", { id: response.id, projectId, module: "pegada" })
        setSummary((response.summary as PegadaSummary | null | undefined) ?? null)
        setSaveMessage("Guardado en nube.")
        if (draftKey) clearCaptureDraft(draftKey)
      } catch (error) {
        console.error("[pegada] save_failed", {
          projectId,
          module: "pegada",
          error: error instanceof Error ? error.message : "unknown_error",
        })
        setSaveMessage("Error al guardar en nube. Revisa conexión y campos.")
        return false
      }
    } else {
      setSaveMessage("Proyecto inválido para guardado.")
      return false
    }

    setCaptureSessionId(createCaptureSessionId())

    setError("")
    if (returnToHub && projectId) {
      window.location.href = backToZoneOrHub
      return true
    }

    setStep(3)
    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await savePegada(false)
  }

  function resetForm() {
    if (draftKey) clearCaptureDraft(draftKey)
    setPrepPhoto(emptyPhoto())
    setAntesPhoto(emptyPhoto())
    setDespuesPhoto(emptyPhoto())
    setMacroZone("")
    setMicroZone("")
    setCriticalInfieldAreas([])
    setLineasMarkbox(false)
    setFtTotales(30)
    setBotesUsados(1)
    setClima([])
    setCondicion("")
    setObservaciones("")
    setSaveMessage("")
    setSummary(null)
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
        <ContextHeader
          title="Captura de Pegada"
          subtitle="Flujo simple: fotos, cuestionario y guardado."
          backHref={backToZoneOrHub}
          backLabel={projectZoneId ? "Zona" : "Proyecto"}
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: projectId, href: `/pulse?project=${encodeURIComponent(projectId)}` },
            { label: "Pegada" },
          ]}
          projectLabel={projectId}
          zoneLabel={macroZone && microZone ? `${macroZone} / ${microZone}` : null}
          statusLabel={step === 3 ? "Completado" : `Paso ${displayStep}/${totalSteps}`}
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

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Paso {displayStep} de {totalSteps}
        </div>

        {draftRecovered ? (
          <div className="rounded-xl border border-cyan-500/70 bg-cyan-500/10 p-3 text-sm text-cyan-200">
            Borrador recuperado. Puedes continuar con la captura.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-red-300">{error}</div>
        ) : null}

        {step === 1 ? (
          <section className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-xl font-semibold">1) Fotos de referencia (opcionales)</h2>
            <p className="text-sm text-neutral-400">Si ya subiste fotos al iniciar captura, puedes continuar sin volver a subir aquí.</p>

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
            {prefillFromZone ? (
              <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Fotos cargadas desde Paso 1 de la zona.
              </p>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">MacroZone</span>
              <select
                value={macroZone}
                onChange={(event) => {
                  setMacroZone(event.target.value as MacroZone | "")
                  setMicroZone("")
                  setCriticalInfieldAreas([])
                  setLineasMarkbox(false)
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                required
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
                required
                disabled={!macroZone}
              >
                <option value="">Selecciona MicroZone</option>
                {microZoneOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            {isBeisSoftInfield ? (
              <fieldset className="space-y-2">
                <legend className="text-sm text-neutral-300">Zona crítica (opción múltiple)</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BEIS_SOFT_CRITICAL_AREAS.map((item) => {
                    const active = criticalInfieldAreas.includes(item)
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleCriticalInfieldArea(item)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                          active ? "border-amber-500 bg-amber-500/20 text-amber-200" : "border-neutral-700 bg-neutral-950"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-neutral-400">
                  Puedes seleccionar varias. Si eliges al menos una, Ft Totales se desactiva.
                </p>
              </fieldset>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">
                Ft Totales ({isCriticalInfieldSelection ? "fijo por zona crítica" : ftTotales})
              </span>
              <input
                type="range"
                min={1}
                max={500}
                value={ftTotales}
                onChange={(event) => setFtTotales(Number(event.target.value))}
                disabled={isCriticalInfieldSelection}
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

            {canShowLineasMarkbox ? (
              <fieldset className="space-y-2">
                <legend className="text-sm text-neutral-300">Markbox adicional</legend>
                <button
                  type="button"
                  onClick={() => setLineasMarkbox((prev) => !prev)}
                  className={`w-full rounded-xl border px-3 py-3 text-sm font-semibold ${
                    lineasMarkbox ? "border-blue-500 bg-blue-500/20 text-blue-200" : "border-neutral-700 bg-neutral-950"
                  }`}
                >
                  {LINEAS_MARKBOX}
                </button>
                <p className="text-xs text-neutral-400">Este botón no modifica Ft Totales.</p>
              </fieldset>
            ) : null}

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
              <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
              <textarea
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              {!prefillFromZone ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl border border-neutral-600 px-4 py-4 text-lg font-semibold hover:bg-neutral-800"
                >
                  Volver a fotos
                </button>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold hover:bg-emerald-700"
              >
                Save Pegada
              </button>
              <button
                type="button"
                onClick={() => void savePegada(true)}
                className="w-full rounded-xl border border-blue-500 px-4 py-4 text-lg font-semibold text-blue-300 hover:bg-blue-500/10"
              >
                {projectZoneId ? "Save & Return to Zone" : "Save & Return to Hub"}
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

            {summary ? (
              <div
                className={`space-y-2 rounded-xl border p-4 ${
                  summary.traffic_light === "green"
                    ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                    : summary.traffic_light === "yellow"
                      ? "border-amber-500/70 bg-amber-500/10 text-amber-200"
                      : "border-red-500/70 bg-red-500/10 text-red-200"
                }`}
              >
                <p className="text-sm font-semibold uppercase">Semáforo: {summary.traffic_light}</p>
                <p className="text-sm">Ratio vs baseline: {summary.ratio_to_baseline.toFixed(3)}</p>
                <p className="text-sm">Predicción de botes: {summary.predicted_cans.toFixed(2)}</p>
                <p className="text-sm">Costo evitable estimado: ${summary.savings_usd.toFixed(2)} USD</p>
              </div>
            ) : null}

            <Link
              href={backToZoneOrHub}
              className="block w-full rounded-xl border border-blue-500 px-4 py-4 text-center text-lg font-semibold text-blue-300 hover:bg-blue-500/10"
            >
              Back to Hub
            </Link>

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
        accept={IMAGE_INPUT_ACCEPT}
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
