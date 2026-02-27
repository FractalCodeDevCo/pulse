"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, useEffect, useMemo, useState } from "react"

import { createCaptureSessionId } from "../../lib/captureSession"
import { clearCaptureDraft, readCaptureDraft, saveCaptureDraft } from "../../lib/captureDraft"
import { IMAGE_INPUT_ACCEPT, processImageFiles } from "../../lib/clientImage"
import { saveZonePhotosCache } from "../../lib/zonePhotoCache"
import ContextHeader from "./ContextHeader"
import {
  getProjectById,
  getProjectZoneById,
  getZoneProgress,
  getZoneStepTemplates,
  toggleProjectZoneStep,
  ZoneStepKey,
} from "../../lib/projects"

type ZoneDetailPageClientProps = {
  projectId: string | null
  projectZoneId: string
}

type RollPlacementSummary = {
  module: "roll-installation"
  roll_length_sem: "green" | "yellow" | "red"
  roll_risk_score: number
  compaction_risk_score: number
  compaction_traffic: "green" | "yellow" | "red"
}

type AdhesiveSummary = {
  module: "pegada"
  traffic_light: "green" | "yellow" | "red"
  ratio_to_baseline: number
  predicted_cans: number
  savings_usd: number
}

type MaterialSummary = {
  module: "material"
  deviation_ratio: number
  deviation_percent: number
  status_color: "verde" | "amarillo" | "rojo"
  valve_current: number
  valve_delta: -1 | 0 | 1
  valve_next: number
  suggestion: string | null
}

type ZoneDetailDraft = {
  openStep: ZoneStepKey | null
  quickNotes: Record<string, string>
  zonePhotos: string[]
  rollLengthFit: "green" | "yellow" | "red" | ""
  totalRollsUsed: string
  totalSeams: string
  compactionMethod: "Plate" | "Roller" | "Manual" | ""
  surfaceFirm: boolean
  moistureOk: boolean
  doubleCompaction: boolean
  rollPlacementSessionId: string
  adhesiveFt: string
  adhesiveCriticalInfieldAreas: string[]
  adhesiveLineasMarkbox: boolean
  adhesiveBotes: string
  adhesiveCondicion: string
  adhesiveClima: string[]
  adhesiveObservaciones: string
  adhesiveSessionId: string
  materialStep: 1 | 2
  materialTipo: "Arena" | "Goma" | ""
  materialPasada: "Sencilla" | "Doble" | ""
  materialValvula: number
  materialBolsasEsperadas: string
  materialBolsasUsadas: string
  materialObservaciones: string
  materialSessionId: string
  materialPhotos: string[]
}

const CONDITION_OPTIONS = ["Excelente", "Buena", "Regular", "Mala"]
const CLIMATE_OPTIONS = ["Soleado", "Nublado", "Lluvioso", "Viento", "Humedad alta"]
const SPORT_CRITICAL_OPTIONS: Record<string, string[]> = {
  beisbol: [
    "Coach A",
    "Coach B",
    "Línea del corredor",
    "Batter Box",
    "Pitcher Mound",
    "Logo",
    "Letras",
    "Curva",
    "Curva diámetro chico",
    "Unión lineal",
  ],
  softbol: [
    "Coach A",
    "Coach B",
    "Línea del corredor",
    "Batter Box",
    "Pitcher Mound",
    "Logo",
    "Letras",
    "Curva",
    "Curva diámetro chico",
    "Unión lineal",
  ],
  football: [
    "Números",
    "Hashmarks",
    "Tick marks",
    "Logo",
    "Letras",
    "Curva",
    "Curva diámetro chico",
    "Unión lineal",
  ],
  soccer: [
    "Curva",
    "Curva diámetro chico",
    "Líneas",
    "Logo",
    "Letras",
    "Unión lineal",
  ],
}
const LINEAR_OPTION = "Unión lineal"

export default function ZoneDetailPageClient({ projectId, projectZoneId }: ZoneDetailPageClientProps) {
  const project = useMemo(() => (projectId ? getProjectById(projectId) : null), [projectId])
  const [zone, setZone] = useState(() => (projectId ? getProjectZoneById(projectId, projectZoneId) : null))
  const [openStep, setOpenStep] = useState<ZoneStepKey | null>(null)
  const [quickNotes, setQuickNotes] = useState<Record<string, string>>({})
  const [zonePhotos, setZonePhotos] = useState<string[]>([])
  const [isReadingPhotos, setIsReadingPhotos] = useState(false)

  // Roll Placement inline metadata
  const [rollLengthFit, setRollLengthFit] = useState<"green" | "yellow" | "red" | "">("")
  const [totalRollsUsed, setTotalRollsUsed] = useState("")
  const [totalSeams, setTotalSeams] = useState("")
  const [compactionMethod, setCompactionMethod] = useState<"Plate" | "Roller" | "Manual" | "">("")
  const [surfaceFirm, setSurfaceFirm] = useState(true)
  const [moistureOk, setMoistureOk] = useState(true)
  const [doubleCompaction, setDoubleCompaction] = useState(false)
  const [rollPlacementSessionId, setRollPlacementSessionId] = useState(() => createCaptureSessionId())
  const [isSavingRollPlacement, setIsSavingRollPlacement] = useState(false)
  const [rollPlacementMessage, setRollPlacementMessage] = useState("")
  const [rollPlacementError, setRollPlacementError] = useState("")
  const [rollPlacementSummary, setRollPlacementSummary] = useState<RollPlacementSummary | null>(null)

  // Adhesive/Pegada inline metadata
  const [adhesiveFt, setAdhesiveFt] = useState("")
  const [adhesiveCriticalInfieldAreas, setAdhesiveCriticalInfieldAreas] = useState<string[]>([])
  const [adhesiveLineasMarkbox, setAdhesiveLineasMarkbox] = useState(false)
  const [adhesiveBotes, setAdhesiveBotes] = useState("")
  const [adhesiveCondicion, setAdhesiveCondicion] = useState("")
  const [adhesiveClima, setAdhesiveClima] = useState<string[]>([])
  const [adhesiveObservaciones, setAdhesiveObservaciones] = useState("")
  const [adhesiveSessionId, setAdhesiveSessionId] = useState(() => createCaptureSessionId())
  const [isSavingAdhesive, setIsSavingAdhesive] = useState(false)
  const [adhesiveMessage, setAdhesiveMessage] = useState("")
  const [adhesiveError, setAdhesiveError] = useState("")
  const [adhesiveSummary, setAdhesiveSummary] = useState<AdhesiveSummary | null>(null)
  const [materialStep, setMaterialStep] = useState<1 | 2>(1)
  const [materialTipo, setMaterialTipo] = useState<"Arena" | "Goma" | "">("")
  const [materialPasada, setMaterialPasada] = useState<"Sencilla" | "Doble" | "">("")
  const [materialValvula, setMaterialValvula] = useState(1)
  const [materialBolsasEsperadas, setMaterialBolsasEsperadas] = useState("")
  const [materialBolsasUsadas, setMaterialBolsasUsadas] = useState("")
  const [materialObservaciones, setMaterialObservaciones] = useState("")
  const [materialSessionId, setMaterialSessionId] = useState(() => createCaptureSessionId())
  const [materialPhotos, setMaterialPhotos] = useState<string[]>([])
  const [isSavingMaterial, setIsSavingMaterial] = useState(false)
  const [materialMessage, setMaterialMessage] = useState("")
  const [materialError, setMaterialError] = useState("")
  const [materialSummary, setMaterialSummary] = useState<MaterialSummary | null>(null)
  const [stepSessionIds, setStepSessionIds] = useState<Record<string, string>>({})
  const [stepSavingKey, setStepSavingKey] = useState<ZoneStepKey | null>(null)
  const [stepSaveMessages, setStepSaveMessages] = useState<Record<string, string>>({})
  const [stepSaveErrors, setStepSaveErrors] = useState<Record<string, string>>({})
  const [draftReady, setDraftReady] = useState(false)
  const [draftRecovered, setDraftRecovered] = useState(false)
  const draftKey = useMemo(
    () => (projectId ? `pulse_draft_zone_detail_${projectId}_${projectZoneId}` : null),
    [projectId, projectZoneId],
  )

  const stepTemplates = useMemo(() => (zone ? getZoneStepTemplates(zone.zoneType) : []), [zone])
  const progress = zone ? getZoneProgress(zone) : 0
  const canOpenProcesses = zonePhotos.length > 0
  const adhesiveCriticalOptions = zone ? SPORT_CRITICAL_OPTIONS[zone.fieldType] ?? [] : []
  const hasAdhesiveCriticalSelection = adhesiveCriticalInfieldAreas.length > 0
  const isAdhesiveLinearOnlySelection =
    adhesiveCriticalInfieldAreas.length === 1 && adhesiveCriticalInfieldAreas[0] === LINEAR_OPTION
  const disableAdhesiveFtSlider = hasAdhesiveCriticalSelection && !isAdhesiveLinearOnlySelection

  useEffect(() => {
    if (!projectId || !zone) return
    saveZonePhotosCache(projectId, zone.id, zonePhotos)
  }, [projectId, zone, zonePhotos])

  useEffect(() => {
    if (!draftKey) return
    const draft = readCaptureDraft<ZoneDetailDraft>(draftKey)
    if (draft) {
      setOpenStep(draft.openStep)
      setQuickNotes(draft.quickNotes)
      setZonePhotos(draft.zonePhotos)
      setRollLengthFit(draft.rollLengthFit)
      setTotalRollsUsed(draft.totalRollsUsed)
      setTotalSeams(draft.totalSeams)
      setCompactionMethod(draft.compactionMethod)
      setSurfaceFirm(draft.surfaceFirm)
      setMoistureOk(draft.moistureOk)
      setDoubleCompaction(draft.doubleCompaction)
      setRollPlacementSessionId(draft.rollPlacementSessionId || createCaptureSessionId())
      setAdhesiveFt(draft.adhesiveFt)
      setAdhesiveCriticalInfieldAreas(draft.adhesiveCriticalInfieldAreas)
      setAdhesiveLineasMarkbox(draft.adhesiveLineasMarkbox)
      setAdhesiveBotes(draft.adhesiveBotes)
      setAdhesiveCondicion(draft.adhesiveCondicion)
      setAdhesiveClima(draft.adhesiveClima)
      setAdhesiveObservaciones(draft.adhesiveObservaciones)
      setAdhesiveSessionId(draft.adhesiveSessionId || createCaptureSessionId())
      setMaterialStep(draft.materialStep)
      setMaterialTipo(draft.materialTipo)
      setMaterialPasada(draft.materialPasada)
      setMaterialValvula(draft.materialValvula)
      setMaterialBolsasEsperadas(draft.materialBolsasEsperadas)
      setMaterialBolsasUsadas(draft.materialBolsasUsadas)
      setMaterialObservaciones(draft.materialObservaciones)
      setMaterialSessionId(draft.materialSessionId || createCaptureSessionId())
      setMaterialPhotos(draft.materialPhotos)
      setDraftRecovered(true)
    }
    setDraftReady(true)
  }, [draftKey])

  useEffect(() => {
    if (!draftReady || !draftKey) return

    const hasQuickNotes = Object.values(quickNotes).some((value) => value.trim().length > 0)
    const hasMeaningfulDraft = Boolean(
      openStep ||
        hasQuickNotes ||
        zonePhotos.length > 0 ||
        rollLengthFit ||
        totalRollsUsed ||
        totalSeams ||
        compactionMethod ||
        adhesiveFt ||
        adhesiveCriticalInfieldAreas.length > 0 ||
        adhesiveLineasMarkbox ||
        adhesiveBotes ||
        adhesiveCondicion ||
        adhesiveClima.length > 0 ||
        adhesiveObservaciones.trim().length > 0 ||
        materialStep === 2 ||
        materialTipo ||
        materialPasada ||
        materialBolsasEsperadas ||
        materialBolsasUsadas ||
        materialObservaciones.trim().length > 0 ||
        materialPhotos.length > 0,
    )

    if (!hasMeaningfulDraft) {
      clearCaptureDraft(draftKey)
      return
    }

    saveCaptureDraft<ZoneDetailDraft>(draftKey, {
      openStep,
      quickNotes,
      zonePhotos,
      rollLengthFit,
      totalRollsUsed,
      totalSeams,
      compactionMethod,
      surfaceFirm,
      moistureOk,
      doubleCompaction,
      rollPlacementSessionId,
      adhesiveFt,
      adhesiveCriticalInfieldAreas,
      adhesiveLineasMarkbox,
      adhesiveBotes,
      adhesiveCondicion,
      adhesiveClima,
      adhesiveObservaciones,
      adhesiveSessionId,
      materialStep,
      materialTipo,
      materialPasada,
      materialValvula,
      materialBolsasEsperadas,
      materialBolsasUsadas,
      materialObservaciones,
      materialSessionId,
      materialPhotos,
    })
  }, [
    adhesiveBotes,
    adhesiveClima,
    adhesiveCondicion,
    adhesiveCriticalInfieldAreas,
    adhesiveFt,
    adhesiveLineasMarkbox,
    adhesiveObservaciones,
    adhesiveSessionId,
    materialStep,
    materialTipo,
    materialPasada,
    materialValvula,
    materialBolsasEsperadas,
    materialBolsasUsadas,
    materialObservaciones,
    materialSessionId,
    materialPhotos,
    compactionMethod,
    doubleCompaction,
    draftKey,
    draftReady,
    moistureOk,
    openStep,
    quickNotes,
    rollLengthFit,
    rollPlacementSessionId,
    surfaceFirm,
    totalRollsUsed,
    totalSeams,
    zonePhotos,
  ])

  function toggleStep(stepKey: ZoneStepKey) {
    if (!projectId || !zone) return
    const updated = toggleProjectZoneStep(projectId, zone.id, stepKey)
    if (updated) setZone(updated)
  }

  async function handleZonePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsReadingPhotos(true)
    try {
      const urls = await processImageFiles(Array.from(files))
      setZonePhotos((prev) => [...prev, ...urls].slice(0, 6))
    } finally {
      setIsReadingPhotos(false)
    }
  }

  function removeZonePhoto(index: number) {
    setZonePhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleAdhesiveClimate(option: string) {
    setAdhesiveClima((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]))
  }

  function toggleAdhesiveCriticalInfieldArea(item: string) {
    setAdhesiveCriticalInfieldAreas((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item)
      return [...current, item]
    })
  }

  async function handleMaterialPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return
    setIsReadingPhotos(true)
    try {
      const urls = await processImageFiles(Array.from(files))
      setMaterialPhotos((prev) => [...prev, ...urls].slice(0, 8))
    } finally {
      setIsReadingPhotos(false)
    }
  }

  function removeMaterialPhoto(index: number) {
    setMaterialPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function getStepSessionId(stepKey: ZoneStepKey): string {
    return stepSessionIds[stepKey] ?? createCaptureSessionId()
  }

  async function submitSimpleStep(stepKey: ZoneStepKey) {
    if (!projectId || !zone) return

    const moduleForStep = stepKey === "COMPACT" ? "compactacion" : "rollos"
    const sessionId = getStepSessionId(stepKey)
    const note = (quickNotes[stepKey] ?? "").trim()
    const stepPhotos = zonePhotos.slice(0, 3)

    setStepSaveErrors((prev) => ({ ...prev, [stepKey]: "" }))
    setStepSaveMessages((prev) => ({ ...prev, [stepKey]: "" }))
    setStepSavingKey(stepKey)

    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleForStep,
          projectId,
          fieldType: zone.fieldType,
          payload: {
            zone: zone.microZone,
            macro_zone: zone.macroZone,
            micro_zone: zone.microZone,
            zone_type: zone.zoneType,
            project_zone_id: zone.id,
            capture_session_id: sessionId,
            capture_status: "complete",
            step_key: stepKey,
            step_label: stepTemplates.find((step) => step.key === stepKey)?.label ?? stepKey,
            note,
            photos: stepPhotos,
          },
        }),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar captura del paso.")

      setStepSaveMessages((prev) => ({ ...prev, [stepKey]: "Captura guardada en nube." }))
      setStepSessionIds((prev) => ({ ...prev, [stepKey]: createCaptureSessionId() }))
      setZonePhotos([])
      if (!zone.completedStepKeys.includes(stepKey)) toggleStep(stepKey)
    } catch (err) {
      setStepSaveErrors((prev) => ({
        ...prev,
        [stepKey]: err instanceof Error ? err.message : "Error al guardar captura del paso.",
      }))
    } finally {
      setStepSavingKey(null)
    }
  }

  async function submitRollPlacementInline() {
    if (!projectId || !zone) return
    const parsedRolls = totalRollsUsed.trim() === "" ? null : Number(totalRollsUsed)
    const parsedSeams = totalSeams.trim() === "" ? null : Number(totalSeams)
    if (parsedRolls !== null && (!Number.isInteger(parsedRolls) || parsedRolls < 0)) {
      return setRollPlacementError("Total rolls debe ser entero >= 0.")
    }
    if (parsedSeams !== null && (!Number.isInteger(parsedSeams) || parsedSeams < 0)) {
      return setRollPlacementError("Total seams debe ser entero >= 0.")
    }

    const isCompleteCapture =
      Boolean(rollLengthFit) &&
      parsedRolls !== null &&
      parsedSeams !== null &&
      Boolean(compactionMethod)

    const compactingPhoto = zonePhotos[0] ?? null
    const inProgressPhoto = zonePhotos[1] ?? null
    const completedPhoto = zonePhotos[2] ?? null

    setRollPlacementError("")
    setRollPlacementMessage("")
    setRollPlacementSummary(null)
    setIsSavingRollPlacement(true)

    try {
      const response = await fetch("/api/roll-installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          project_zone_id: zone.id,
          field_type: zone.fieldType,
          macro_zone: zone.macroZone,
          micro_zone: zone.microZone,
          zone_type: zone.zoneType,
          zone: zone.microZone,
          roll_length_fit: rollLengthFit || undefined,
          total_rolls_used: parsedRolls ?? undefined,
          total_seams: parsedSeams ?? undefined,
          compaction_surface_firm: surfaceFirm,
          compaction_moisture_ok: moistureOk,
          compaction_double: doubleCompaction,
          compaction_method: compactionMethod || undefined,
          capture_session_id: rollPlacementSessionId,
          capture_status: isCompleteCapture ? "complete" : "incomplete",
          photos: {
            compacting: compactingPhoto ?? undefined,
            in_progress: inProgressPhoto ?? undefined,
            completed: completedPhoto ?? undefined,
          },
        }),
      })
      const data = (await response.json()) as { error?: string; summary?: RollPlacementSummary | null }
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar Roll Placement")

      setRollPlacementMessage(isCompleteCapture ? "Roll Placement guardado." : "Roll Placement parcial guardado.")
      setRollPlacementSummary(data.summary ?? null)
      setRollPlacementSessionId(createCaptureSessionId())
      setZonePhotos([])
      if (isCompleteCapture && !zone.completedStepKeys.includes("ROLL_PLACEMENT")) toggleStep("ROLL_PLACEMENT")
    } catch (err) {
      setRollPlacementError(err instanceof Error ? err.message : "Error al guardar Roll Placement.")
    } finally {
      setIsSavingRollPlacement(false)
    }
  }

  async function submitAdhesiveInline() {
    if (!projectId || !zone) return
    if (!adhesiveBotes || Number(adhesiveBotes) <= 0) return setAdhesiveError("Botes usados debe ser mayor a 0.")
    if (!adhesiveCondicion) return setAdhesiveError("Condición es requerida.")
    if (!disableAdhesiveFtSlider && (!adhesiveFt || Number(adhesiveFt) <= 0)) {
      return setAdhesiveError("Ft Totales debe ser mayor a 0.")
    }

    const prep = zonePhotos[0] ?? null
    const antes = zonePhotos[1] ?? null
    const despues = zonePhotos[2] ?? null

    setAdhesiveError("")
    setAdhesiveMessage("")
    setAdhesiveSummary(null)
    setIsSavingAdhesive(true)

    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "pegada",
          projectId,
          fieldType: zone.fieldType,
          payload: {
            zone: zone.microZone,
            macro_zone: zone.macroZone,
            micro_zone: zone.microZone,
            project_zone_id: zone.id,
            zone_type: zone.zoneType,
            critical_infield_area: hasAdhesiveCriticalSelection ? adhesiveCriticalInfieldAreas[0] : undefined,
            critical_infield_areas: hasAdhesiveCriticalSelection ? adhesiveCriticalInfieldAreas : undefined,
            markbox: undefined,
            ftTotales: disableAdhesiveFtSlider ? 10 : Number(adhesiveFt),
            botesUsados: Number(adhesiveBotes),
            condicion: adhesiveCondicion,
            clima: adhesiveClima,
            observaciones: adhesiveObservaciones.trim(),
            capture_session_id: adhesiveSessionId,
            capture_status: "complete",
            evidencePhotos: {
              prep: prep ?? undefined,
              antes: antes ?? undefined,
              despues: despues ?? undefined,
            },
          },
        }),
      })
      const data = (await response.json()) as { error?: string; summary?: AdhesiveSummary | null }
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar Adhesive")

      setAdhesiveMessage("Adhesive (Pegada) guardado.")
      setAdhesiveSummary(data.summary ?? null)
      setAdhesiveSessionId(createCaptureSessionId())
      setZonePhotos([])
      if (!zone.completedStepKeys.includes("ADHESIVE")) toggleStep("ADHESIVE")
    } catch (err) {
      setAdhesiveError(err instanceof Error ? err.message : "Error al guardar Adhesive.")
    } finally {
      setIsSavingAdhesive(false)
    }
  }

  async function submitMaterialInline() {
    if (!projectId || !zone) return
    const expected = Number(materialBolsasEsperadas)
    const used = Number(materialBolsasUsadas)
    if (!materialTipo) return setMaterialError("Tipo de material es requerido.")
    if (!materialPasada) return setMaterialError("Tipo de pasada es requerido.")
    if (!expected || expected <= 0) return setMaterialError("Bolsas esperadas debe ser mayor a 0.")
    if (!used || used <= 0) return setMaterialError("Bolsas utilizadas debe ser mayor a 0.")

    setMaterialError("")
    setMaterialMessage("")
    setMaterialSummary(null)
    setIsSavingMaterial(true)

    try {
      const response = await fetch("/api/material-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectZoneId: zone.id,
          zoneType: zone.zoneType,
          fieldType: zone.fieldType,
          captureSessionId: materialSessionId,
          captureStatus: "complete",
          tipoMaterial: materialTipo,
          tipoPasada: materialPasada,
          valvula: materialValvula,
          bolsasEsperadas: expected,
          bolsasUtilizadas: used,
          observaciones: materialObservaciones,
          fotos: materialPhotos,
        }),
      })
      const data = (await response.json()) as { error?: string; summary?: MaterialSummary | null }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar Material")

      setMaterialMessage("Material guardado.")
      setMaterialSummary(data.summary ?? null)
      setMaterialSessionId(createCaptureSessionId())
      setMaterialStep(1)
      setMaterialPhotos([])
      if (!zone.completedStepKeys.includes("MATERIAL")) toggleStep("MATERIAL")
    } catch (err) {
      setMaterialError(err instanceof Error ? err.message : "Error al guardar Material.")
    } finally {
      setIsSavingMaterial(false)
    }
  }

  if (!projectId || !project || !zone) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Zona no encontrada para este proyecto.</p>
        <Link href={`/pulse?project=${encodeURIComponent(projectId ?? "")}`} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold">
          Volver a zonas
        </Link>
      </main>
    )
  }

  const query = new URLSearchParams({
    project: project.id,
    projectZoneId: zone.id,
    macroZone: zone.macroZone,
    microZone: zone.microZone,
    fieldType: zone.fieldType,
    zoneType: zone.zoneType,
  }).toString()

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <ContextHeader
          title={zone.microZone}
          subtitle="Flujo por zona: fotos primero, luego procesos."
          backHref={`/pulse?project=${encodeURIComponent(project.id)}`}
          backLabel="Zonas"
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            { label: project.name, href: `/pulse?project=${encodeURIComponent(project.id)}` },
            { label: zone.microZone },
          ]}
          projectLabel={project.id}
          zoneLabel={`${zone.macroZone} / ${zone.microZone}`}
          statusLabel={`${progress}% completado`}
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Paso 1 · Fotos de zona</h2>
          <p className="text-sm text-neutral-400">Primero toma evidencia de la zona. Después se desbloquea el menú de procesos.</p>
          {draftRecovered ? (
            <p className="rounded-xl border border-cyan-500/70 bg-cyan-500/10 p-3 text-sm text-cyan-200">
              Borrador recuperado. Continúa donde te quedaste.
            </p>
          ) : null}
          <input
            type="file"
            accept={IMAGE_INPUT_ACCEPT}
            multiple
            onChange={(event) => void handleZonePhotos(event)}
            className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
          />

          {zonePhotos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {zonePhotos.map((photo, index) => (
                <div key={`${photo}-${index}`} className="space-y-2">
                  <Image
                    src={photo}
                    alt={`Zona ${index + 1}`}
                    width={600}
                    height={400}
                    unoptimized
                    className="h-28 w-full rounded-xl border border-neutral-700 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeZonePhoto(index)}
                    className="w-full rounded-lg border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="rounded-xl border border-neutral-700 px-3 py-3 text-sm text-neutral-300">
            {canOpenProcesses ? "Procesos desbloqueados." : "Sube al menos 1 foto para desbloquear procesos."}
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Paso 2 · Procesos por zona</h2>
          <p className="text-sm text-neutral-400">
            {zone.zoneType === "GLOBAL"
              ? "Compactación general → Layout → Material."
              : "Compaction → Roll Placement → Sewing → Cut → Adhesive."}
          </p>

          <div className={canOpenProcesses ? "space-y-2" : "pointer-events-none space-y-2 opacity-50"}>
            {stepTemplates.map((step) => {
              const completed = zone.completedStepKeys.includes(step.key)
              const expanded = openStep === step.key
              const shouldAutoExpand =
                step.key === "ROLL_PLACEMENT" || step.key === "ADHESIVE" || step.key === "MATERIAL" || step.key === "LAYOUT"

              return (
                <div key={step.key} className="rounded-xl border border-neutral-700 bg-neutral-950">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenStep((prev) => (prev === step.key ? null : step.key))}
                      className="cursor-pointer text-left"
                    >
                      <p className="font-medium">{step.label}</p>
                      <p className="text-xs text-neutral-400">{step.key}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenStep((prev) => (prev === step.key ? null : step.key))}
                        className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-semibold hover:bg-neutral-800"
                      >
                        {expanded ? "Cerrar menú" : "Abrir menú"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          toggleStep(step.key)
                          if (shouldAutoExpand) setOpenStep(step.key)
                        }}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          completed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-neutral-700 hover:bg-neutral-600"
                        }`}
                      >
                        {completed ? "Completado" : "Marcar"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="space-y-3 border-t border-neutral-800 px-4 py-4">
                      {step.key === "ROLL_PLACEMENT" ? (
                        <>
                          <p className="text-sm text-neutral-300">Metadata de Roll Placement (inline).</p>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">Roll Length Fit</span>
                              <select
                                value={rollLengthFit}
                                onChange={(event) => setRollLengthFit(event.target.value as "green" | "yellow" | "red" | "")}
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                              >
                                <option value="">Selecciona</option>
                                <option value="green">Green - Normal</option>
                                <option value="yellow">Yellow - Justo</option>
                                <option value="red">Red - Falta/Sobra demasiado</option>
                              </select>
                            </label>
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">Compaction Method</span>
                              <select
                                value={compactionMethod}
                                onChange={(event) => setCompactionMethod(event.target.value as "Plate" | "Roller" | "Manual" | "")}
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                              >
                                <option value="">Selecciona</option>
                                <option value="Plate">Plate</option>
                                <option value="Roller">Roller</option>
                                <option value="Manual">Manual</option>
                              </select>
                            </label>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">Total Rolls Used</span>
                              <input
                                type="number"
                                min={0}
                                value={totalRollsUsed}
                                onChange={(event) => setTotalRollsUsed(event.target.value)}
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                              />
                            </label>
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">Total Seams</span>
                              <input
                                type="number"
                                min={0}
                                value={totalSeams}
                                onChange={(event) => setTotalSeams(event.target.value)}
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                              />
                            </label>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => setSurfaceFirm((prev) => !prev)}
                              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                surfaceFirm ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
                              }`}
                            >
                              Surface Firm: {surfaceFirm ? "Yes" : "No"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setMoistureOk((prev) => !prev)}
                              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                moistureOk ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
                              }`}
                            >
                              Moisture OK: {moistureOk ? "Yes" : "No"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDoubleCompaction((prev) => !prev)}
                              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                doubleCompaction ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
                              }`}
                            >
                              Double: {doubleCompaction ? "Yes" : "No"}
                            </button>
                          </div>
                          <p className="text-xs text-neutral-400">
                            Puedes guardar sin fotos o usando las primeras fotos de zona.
                          </p>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => void submitRollPlacementInline()}
                              disabled={isSavingRollPlacement}
                              className="rounded-xl bg-orange-600 py-3 font-semibold hover:bg-orange-700 disabled:opacity-50"
                            >
                              Guardar Roll Placement
                            </button>
                            <Link
                              href={`/pulse/roll-verification?${query}`}
                              className="rounded-xl border border-cyan-500 py-3 text-center font-semibold text-cyan-300 hover:bg-cyan-500/10"
                            >
                              Roll Verification
                            </Link>
                          </div>

                          <Link
                            href={`/pulse/roll-installation?${query}&prefill=1`}
                            className="block rounded-xl border border-neutral-600 py-3 text-center text-sm font-semibold hover:bg-neutral-800"
                          >
                            Abrir pantalla completa
                          </Link>

                          {rollPlacementError ? (
                            <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
                              {rollPlacementError}
                            </p>
                          ) : null}
                          {rollPlacementMessage ? (
                            <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                              {rollPlacementMessage}
                            </p>
                          ) : null}
                          {rollPlacementSummary ? (
                            <div
                              className={`rounded-xl border p-3 text-sm ${
                                rollPlacementSummary.compaction_traffic === "green"
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                                  : rollPlacementSummary.compaction_traffic === "yellow"
                                    ? "border-amber-500/70 bg-amber-500/10 text-amber-200"
                                    : "border-red-500/70 bg-red-500/10 text-red-200"
                              }`}
                            >
                              Roll risk: {rollPlacementSummary.roll_risk_score} · Compaction risk: {rollPlacementSummary.compaction_risk_score}
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {step.key === "ADHESIVE" ? (
                        <>
                          <p className="text-sm text-neutral-300">Metadata de Adhesive (Pegada) inline.</p>

                          {adhesiveCriticalOptions.length > 0 ? (
                            <fieldset className="space-y-2">
                              <legend className="text-sm text-neutral-300">Zona crítica (opción múltiple)</legend>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {adhesiveCriticalOptions.map((item) => {
                                  const active = adhesiveCriticalInfieldAreas.includes(item)
                                  return (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() => toggleAdhesiveCriticalInfieldArea(item)}
                                      className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                        active
                                          ? "border-amber-500 bg-amber-500/20 text-amber-200"
                                          : "border-neutral-700 bg-neutral-900"
                                      }`}
                                    >
                                      {item}
                                    </button>
                                  )
                                })}
                              </div>
                            </fieldset>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">
                                Ft Totales ({disableAdhesiveFtSlider ? "fijo por selección actual" : adhesiveFt || 0})
                              </span>
                              <input
                                type="range"
                                min={1}
                                max={500}
                                value={adhesiveFt}
                                onChange={(event) => setAdhesiveFt(event.target.value)}
                                disabled={disableAdhesiveFtSlider}
                                className="w-full disabled:cursor-not-allowed disabled:opacity-40"
                              />
                            </label>
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">Botes usados</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={adhesiveBotes}
                                onChange={(event) => setAdhesiveBotes(event.target.value)}
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                              />
                            </label>
                          </div>

                          <label className="block space-y-2">
                            <span className="text-sm text-neutral-300">Condición</span>
                            <select
                              value={adhesiveCondicion}
                              onChange={(event) => setAdhesiveCondicion(event.target.value)}
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                            >
                              <option value="">Selecciona condición</option>
                              {CONDITION_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>

                          <fieldset className="space-y-2">
                            <legend className="text-sm text-neutral-300">Clima</legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {CLIMATE_OPTIONS.map((option) => {
                                const checked = adhesiveClima.includes(option)
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggleAdhesiveClimate(option)}
                                    className={`rounded-xl border px-3 py-3 text-sm ${
                                      checked ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
                                    }`}
                                  >
                                    {option}
                                  </button>
                                )
                              })}
                            </div>
                          </fieldset>

                          <label className="block space-y-2">
                            <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
                            <textarea
                              rows={3}
                              value={adhesiveObservaciones}
                              onChange={(event) => setAdhesiveObservaciones(event.target.value)}
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => void submitAdhesiveInline()}
                            disabled={isSavingAdhesive}
                            className="w-full rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
                          >
                            Guardar Adhesive
                          </button>

                          <Link
                            href={`/capture/pegada?${query}&prefill=1`}
                            className="block rounded-xl border border-neutral-600 py-3 text-center text-sm font-semibold hover:bg-neutral-800"
                          >
                            Abrir pantalla completa de Pegada
                          </Link>

                          {adhesiveError ? (
                            <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
                              {adhesiveError}
                            </p>
                          ) : null}
                          {adhesiveMessage ? (
                            <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                              {adhesiveMessage}
                            </p>
                          ) : null}
                          {adhesiveSummary ? (
                            <div
                              className={`rounded-xl border p-3 text-sm ${
                                adhesiveSummary.traffic_light === "green"
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                                  : adhesiveSummary.traffic_light === "yellow"
                                    ? "border-amber-500/70 bg-amber-500/10 text-amber-200"
                                    : "border-red-500/70 bg-red-500/10 text-red-200"
                              }`}
                            >
                              Ratio: {adhesiveSummary.ratio_to_baseline.toFixed(3)} · Predicción: {adhesiveSummary.predicted_cans.toFixed(2)} botes
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {step.key === "MATERIAL" ? (
                        <>
                          <p className="text-sm text-neutral-300">Material inline: fotos primero y luego cuestionario.</p>

                          {materialStep === 1 ? (
                            <div className="space-y-3">
                              <label className="block space-y-2">
                                <span className="text-sm text-neutral-300">Fotos de material (galería o cámara)</span>
                                <input
                                  type="file"
                                  accept={IMAGE_INPUT_ACCEPT}
                                  multiple
                                  onChange={(event) => void handleMaterialPhotos(event)}
                                  className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
                                />
                              </label>
                              {materialPhotos.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {materialPhotos.map((photo, index) => (
                                    <div key={`${photo}-${index}`} className="space-y-2">
                                      <Image
                                        src={photo}
                                        alt={`Material ${index + 1}`}
                                        width={600}
                                        height={400}
                                        unoptimized
                                        className="h-24 w-full rounded-xl border border-neutral-700 object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeMaterialPhoto(index)}
                                        className="w-full rounded-lg border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800"
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-neutral-400">Sin fotos cargadas.</p>
                              )}
                              <button
                                type="button"
                                onClick={() => setMaterialStep(2)}
                                className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-700"
                              >
                                Continuar a Material
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <label className="block space-y-2">
                                <span className="text-sm text-neutral-300">Tipo de material</span>
                                <select
                                  value={materialTipo}
                                  onChange={(event) => setMaterialTipo(event.target.value as "Arena" | "Goma" | "")}
                                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                                >
                                  <option value="">Selecciona</option>
                                  <option value="Arena">Arena</option>
                                  <option value="Goma">Goma</option>
                                </select>
                              </label>
                              <label className="block space-y-2">
                                <span className="text-sm text-neutral-300">Tipo de pasada</span>
                                <select
                                  value={materialPasada}
                                  onChange={(event) => setMaterialPasada(event.target.value as "Sencilla" | "Doble" | "")}
                                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                                >
                                  <option value="">Selecciona</option>
                                  <option value="Sencilla">Sencilla</option>
                                  <option value="Doble">Doble</option>
                                </select>
                              </label>
                              <label className="block space-y-2">
                                <span className="text-sm text-neutral-300">Válvula (1-6)</span>
                                <input
                                  type="range"
                                  min={1}
                                  max={6}
                                  step={1}
                                  value={materialValvula}
                                  onChange={(event) => setMaterialValvula(Number(event.target.value))}
                                  className="w-full"
                                />
                                <p className="text-xs text-neutral-400">Seleccionado: {materialValvula}</p>
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block space-y-2">
                                  <span className="text-sm text-neutral-300">Bolsas esperadas</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={materialBolsasEsperadas}
                                    onChange={(event) => setMaterialBolsasEsperadas(event.target.value)}
                                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                                  />
                                </label>
                                <label className="block space-y-2">
                                  <span className="text-sm text-neutral-300">Bolsas utilizadas</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={materialBolsasUsadas}
                                    onChange={(event) => setMaterialBolsasUsadas(event.target.value)}
                                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                                  />
                                </label>
                              </div>
                              <label className="block space-y-2">
                                <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
                                <textarea
                                  rows={3}
                                  value={materialObservaciones}
                                  onChange={(event) => setMaterialObservaciones(event.target.value)}
                                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                                />
                              </label>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={() => setMaterialStep(1)}
                                  className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800"
                                >
                                  Volver a fotos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void submitMaterialInline()}
                                  disabled={isSavingMaterial}
                                  className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {isSavingMaterial ? "Guardando..." : "Guardar Material"}
                                </button>
                              </div>
                            </div>
                          )}

                          {materialError ? (
                            <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
                              {materialError}
                            </p>
                          ) : null}
                          {materialMessage ? (
                            <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                              {materialMessage}
                            </p>
                          ) : null}
                          {materialSummary ? (
                            <div className="rounded-xl border border-cyan-500/70 bg-cyan-500/10 p-3 text-sm text-cyan-200">
                              Desviación: {materialSummary.deviation_percent.toFixed(2)}% · Válvula: {materialSummary.valve_current} →
                              {" "}{materialSummary.valve_next}
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {step.key !== "ROLL_PLACEMENT" && step.key !== "ADHESIVE" && step.key !== "MATERIAL" ? (
                        <>
                          <label className="block space-y-2">
                            <span className="text-sm text-neutral-300">Nota rápida (opcional)</span>
                            <textarea
                              rows={2}
                              value={quickNotes[step.key] ?? ""}
                              onChange={(event) =>
                                setQuickNotes((prev) => ({ ...prev, [step.key]: event.target.value }))
                              }
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleStep(step.key)}
                            className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800"
                          >
                            Marcar paso {step.label}
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitSimpleStep(step.key)}
                            disabled={stepSavingKey === step.key}
                            className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {stepSavingKey === step.key ? "Guardando..." : `Guardar captura ${step.label}`}
                          </button>
                          {stepSaveErrors[step.key] ? (
                            <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
                              {stepSaveErrors[step.key]}
                            </p>
                          ) : null}
                          {stepSaveMessages[step.key] ? (
                            <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                              {stepSaveMessages[step.key]}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold">Registro adicional</h2>
          <Link
            href={`/pulse/history?project=${encodeURIComponent(project.id)}&macroZone=${encodeURIComponent(zone.macroZone)}&microZone=${encodeURIComponent(zone.microZone)}`}
            className="block rounded-xl border border-amber-500 py-3 text-center font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            Ver historial de esta zona
          </Link>
          <Link
            href={`/capture/incidencias?${query}`}
            className="block rounded-xl border border-red-500 py-3 text-center font-semibold text-red-300 hover:bg-red-500/10"
          >
            Incidencias
          </Link>
        </section>

        <Link
          href={`/pulse?project=${encodeURIComponent(project.id)}`}
          className="block rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
        >
          Volver a zonas
        </Link>

        {isReadingPhotos ? <p className="text-sm text-neutral-400">Procesando fotos...</p> : null}
      </section>
    </main>
  )
}
