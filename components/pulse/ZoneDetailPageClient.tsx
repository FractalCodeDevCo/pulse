"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, useEffect, useMemo, useState } from "react"

import { createCaptureSessionId } from "../../lib/captureSession"
import { IMAGE_INPUT_ACCEPT, processImageFiles } from "../../lib/clientImage"
import { readPlanAnalysisCache, savePlanAnalysisCache } from "../../lib/planIntelligence/cache"
import { PlanAnalysisResult } from "../../lib/planIntelligence/types"
import { suggestNextRollsByZone } from "../../lib/planIntelligence/suggest"
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

function inferPlanZoneKeys(macroZone: string, microZone: string): string[] {
  const macro = macroZone.toLowerCase()
  const micro = microZone.toLowerCase()
  const merged = `${macro} ${micro}`
  const keys = new Set<string>()

  if (merged.includes("outfield")) keys.add("outfield")
  if (merged.includes("infield")) keys.add("infield")
  if (merged.includes("warning")) keys.add("warning_track")
  if (merged.includes("sideline")) keys.add("sideline")
  if (merged.includes("endzone")) keys.add("endzone")
  if (keys.size === 0) keys.add("generic")

  return [...keys]
}

type PlanSuggestedRoll = {
  label: string
  totalLinearFt: number | null
  chopCount: number
  splitCount: number
}

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
  const [sewingTotalSeams, setSewingTotalSeams] = useState("")
  const [rollColorLabels, setRollColorLabels] = useState<string[]>([])
  const [rollColorInput, setRollColorInput] = useState("")
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
  const [flowSessionId, setFlowSessionId] = useState(() => createCaptureSessionId())
  const [isSavingFlow, setIsSavingFlow] = useState(false)
  const [flowMessage, setFlowMessage] = useState("")
  const [flowError, setFlowError] = useState("")
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<string | null>(null)
  const [lastCloudFingerprint, setLastCloudFingerprint] = useState<string | null>(null)
  const [planCacheVersion, setPlanCacheVersion] = useState(0)
  const [useSerpentineSuggestions, setUseSerpentineSuggestions] = useState(false)

  const stepTemplates = useMemo(() => (zone ? getZoneStepTemplates(zone.zoneType) : []), [zone])
  const phasesCompleted = useMemo(
    () => (zone ? zone.stepKeys.filter((key) => zone.completedStepKeys.includes(key)) : []),
    [zone],
  )
  const progress = zone ? getZoneProgress(zone) : 0
  const canOpenProcesses = zonePhotos.length > 0
  const adhesiveCriticalOptions = zone ? SPORT_CRITICAL_OPTIONS[zone.fieldType] ?? [] : []
  const hasAdhesiveCriticalSelection = adhesiveCriticalInfieldAreas.length > 0
  const isAdhesiveLinearOnlySelection =
    adhesiveCriticalInfieldAreas.length === 1 && adhesiveCriticalInfieldAreas[0] === LINEAR_OPTION
  const disableAdhesiveFtSlider = hasAdhesiveCriticalSelection && !isAdhesiveLinearOnlySelection
  const expectedRolls = totalRollsUsed.trim() === "" ? null : Number(totalRollsUsed)
  const hasValidExpectedRolls = expectedRolls !== null && Number.isInteger(expectedRolls) && expectedRolls >= 0
  const rollLabelProgress = hasValidExpectedRolls && expectedRolls > 0 ? Math.min(100, Math.round((rollColorLabels.length / expectedRolls) * 100)) : null
  const planAnalysis = useMemo(() => {
    if (!projectId) return null
    return readPlanAnalysisCache(projectId)
  }, [projectId, planCacheVersion])
  const flowFingerprint = useMemo(() => {
    if (!zone) return ""
    const photos = [...zonePhotos, ...materialPhotos]
      .filter((photo, index, arr) => typeof photo === "string" && photo.length > 0 && arr.indexOf(photo) === index)
      .slice(0, 8)
    return JSON.stringify({
      zoneId: zone.id,
      phasesCompleted,
      photos,
      quickNotes,
      rollPlacement: {
        totalRollsUsed,
        rollLengthFit,
        compactionMethod,
        rollLabelsCount: rollColorLabels.length,
      },
      sewing: {
        totalSeams: sewingTotalSeams,
      },
      adhesive: {
        botesUsados: adhesiveBotes,
        condicion: adhesiveCondicion,
      },
      material: {
        tipo: materialTipo,
        pasada: materialPasada,
      },
    })
  }, [
    zone,
    phasesCompleted,
    zonePhotos,
    materialPhotos,
    quickNotes,
    totalRollsUsed,
    rollLengthFit,
    compactionMethod,
    rollColorLabels.length,
    sewingTotalSeams,
    adhesiveBotes,
    adhesiveCondicion,
    materialTipo,
    materialPasada,
  ])
  const saveState = isSavingFlow
    ? "saving"
    : lastCloudFingerprint && flowFingerprint === lastCloudFingerprint
      ? "cloud"
      : "local"
  const planSuggestedRolls = useMemo<PlanSuggestedRoll[]>(() => {
    if (!zone || !planAnalysis) return []
    const analysis = planAnalysis
    if (!analysis) return []
    const zoneKeys = inferPlanZoneKeys(zone.macroZone, zone.microZone)
    const labels = new Set<string>()
    const rollDetails = new Map(
      analysis.detectedRolls.map((roll) => [
        roll.label,
        {
          totalLinearFt: roll.totalLinearFt,
          chopCount: roll.chopCount ?? 0,
          splitCount: roll.splitCount ?? 0,
        },
      ]),
    )

    for (const key of zoneKeys) {
      const found = analysis.rollZoneMap.find((entry) => entry.zoneKey === key)
      for (const label of found?.labels ?? []) labels.add(label)
    }

    return [...labels]
      .filter((label) => !rollColorLabels.includes(label))
      .slice(0, 30)
      .map((label) => ({
        label,
        totalLinearFt: rollDetails.get(label)?.totalLinearFt ?? null,
        chopCount: rollDetails.get(label)?.chopCount ?? 0,
        splitCount: rollDetails.get(label)?.splitCount ?? 0,
      }))
  }, [planAnalysis, rollColorLabels, zone])

  const nextRollSuggestion = useMemo(() => {
    if (!zone || !planAnalysis) return null
    const zoneKeys = inferPlanZoneKeys(zone.macroZone, zone.microZone)
    return suggestNextRollsByZone(planAnalysis, zoneKeys, rollColorLabels, {
      serpentine: useSerpentineSuggestions,
    })
  }, [zone, planAnalysis, rollColorLabels, useSerpentineSuggestions])

  useEffect(() => {
    if (!projectId) return
    const safeProjectId = projectId
    if (readPlanAnalysisCache(safeProjectId)) return
    let cancelled = false

    async function hydratePlanAnalysis() {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(safeProjectId)}/plan-intelligence`)
        if (!response.ok) return
        const payload = (await response.json()) as { found?: boolean; analysis?: unknown }
        if (!payload.found || !payload.analysis || cancelled) return
        savePlanAnalysisCache(safeProjectId, payload.analysis as PlanAnalysisResult)
        setPlanCacheVersion((current) => current + 1)
      } catch {
        // best effort
      }
    }

    void hydratePlanAnalysis()
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId || !zone) return
    saveZonePhotosCache(projectId, zone.id, zonePhotos)
  }, [projectId, zone, zonePhotos])

  useEffect(() => {
    if (!zone) return
    setOpenStep(null)
    setQuickNotes({})
    setZonePhotos([])
    setRollLengthFit("")
    setTotalRollsUsed("")
    setSewingTotalSeams("")
    setRollColorLabels([])
    setRollColorInput("")
    setCompactionMethod("")
    setSurfaceFirm(true)
    setMoistureOk(true)
    setDoubleCompaction(false)
    setRollPlacementSessionId(createCaptureSessionId())
    setAdhesiveFt("")
    setAdhesiveCriticalInfieldAreas([])
    setAdhesiveLineasMarkbox(false)
    setAdhesiveBotes("")
    setAdhesiveCondicion("")
    setAdhesiveClima([])
    setAdhesiveObservaciones("")
    setAdhesiveSessionId(createCaptureSessionId())
    setMaterialStep(1)
    setMaterialTipo("")
    setMaterialPasada("")
    setMaterialValvula(1)
    setMaterialBolsasEsperadas("")
    setMaterialBolsasUsadas("")
    setMaterialObservaciones("")
    setMaterialSessionId(createCaptureSessionId())
    setMaterialPhotos([])
    setStepSessionIds({})
    setStepSaveMessages({})
    setStepSaveErrors({})
    setFlowSessionId(createCaptureSessionId())
    setFlowMessage("")
    setFlowError("")
    setRollPlacementMessage("")
    setRollPlacementError("")
    setAdhesiveMessage("")
    setAdhesiveError("")
    setMaterialMessage("")
    setMaterialError("")
    setRollPlacementSummary(null)
    setAdhesiveSummary(null)
    setMaterialSummary(null)
    setLastCloudSavedAt(null)
    setLastCloudFingerprint(null)
  }, [zone?.id])

  function normalizeRollColorLabel(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "")
  }

  function addRollColorLabel(raw: string) {
    const normalized = normalizeRollColorLabel(raw)
    if (!normalized) return

    setRollColorLabels((prev) => {
      if (prev.includes(normalized)) return prev
      return [...prev, normalized]
    })
    setRollColorInput("")
  }

  function removeRollColorLabel(label: string) {
    setRollColorLabels((prev) => prev.filter((item) => item !== label))
  }

  function syncRollPlacementTotalsFromLabels() {
    const total = rollColorLabels.length
    setTotalRollsUsed(String(total))
  }

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
    if (parsedRolls !== null && (!Number.isInteger(parsedRolls) || parsedRolls < 0)) {
      return setRollPlacementError("Total rolls debe ser entero >= 0.")
    }

    const isCompleteCapture =
      Boolean(rollLengthFit) &&
      parsedRolls !== null &&
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
          roll_color_labels: rollColorLabels,
          roll_color_count: rollColorLabels.length,
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

  async function submitSewingInline() {
    if (!projectId || !zone) return
    const parsedSeams = sewingTotalSeams.trim() === "" ? null : Number(sewingTotalSeams)
    if (parsedSeams === null || !Number.isInteger(parsedSeams) || parsedSeams < 0) {
      return setStepSaveErrors((prev) => ({ ...prev, SEWING: "Total seams debe ser entero >= 0." }))
    }

    const stepKey: ZoneStepKey = "SEWING"
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
          module: "rollos",
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
            total_seams: parsedSeams,
            note,
            photos: stepPhotos,
          },
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar Sewing.")

      setStepSaveMessages((prev) => ({ ...prev, [stepKey]: "Sewing guardado en nube." }))
      setStepSessionIds((prev) => ({ ...prev, [stepKey]: createCaptureSessionId() }))
      setZonePhotos([])
      if (!zone.completedStepKeys.includes(stepKey)) toggleStep(stepKey)
    } catch (err) {
      setStepSaveErrors((prev) => ({
        ...prev,
        [stepKey]: err instanceof Error ? err.message : "Error al guardar Sewing.",
      }))
    } finally {
      setStepSavingKey(null)
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

  async function submitFlowSession() {
    if (!projectId || !zone) return
    if (phasesCompleted.length === 0) {
      setFlowError("Marca al menos una fase antes de guardar flujo.")
      setFlowMessage("")
      return
    }

    setFlowError("")
    setFlowMessage("")
    setIsSavingFlow(true)

    try {
      const photos = [...zonePhotos, ...materialPhotos]
        .filter((photo, index, arr) => typeof photo === "string" && photo.length > 0 && arr.indexOf(photo) === index)
        .slice(0, 8)

      const response = await fetch("/api/flow-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fieldType: zone.fieldType,
          projectZoneId: zone.id,
          zone: zone.microZone,
          macroZone: zone.macroZone,
          microZone: zone.microZone,
          zoneType: zone.zoneType,
          flowSessionId,
          phasesCompleted,
          phaseSessionIds: stepSessionIds,
          photos,
          flowMetadata: {
            quickNotes,
            rollPlacement: {
              totalRollsUsed: totalRollsUsed.trim() || null,
              rollLengthFit: rollLengthFit || null,
              compactionMethod: compactionMethod || null,
              rollLabelsCount: rollColorLabels.length,
            },
            sewing: {
              totalSeams: sewingTotalSeams.trim() || null,
            },
            adhesive: {
              botesUsados: adhesiveBotes.trim() || null,
              condicion: adhesiveCondicion || null,
            },
            material: {
              tipo: materialTipo || null,
              pasada: materialPasada || null,
            },
          },
        }),
      })
      const data = (await response.json()) as { error?: string; phases_completed?: string[] }
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar flujo.")

      const savedPhases = data.phases_completed ?? phasesCompleted
      setFlowMessage(`Flujo guardado: ${savedPhases.join(" -> ")} · fotos: ${photos.length}`)
      setLastCloudSavedAt(new Date().toISOString())
      setLastCloudFingerprint(flowFingerprint)
      setFlowSessionId(createCaptureSessionId())
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : "Error al guardar flujo.")
    } finally {
      setIsSavingFlow(false)
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
          <p
            className={`rounded-xl border px-3 py-2 text-xs ${
              saveState === "cloud"
                ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                : saveState === "saving"
                  ? "border-cyan-500/70 bg-cyan-500/10 text-cyan-200"
                  : "border-amber-500/70 bg-amber-500/10 text-amber-200"
            }`}
          >
            Estado de guardado:{" "}
            {saveState === "cloud"
              ? `Guardado en nube${lastCloudSavedAt ? ` · ${new Date(lastCloudSavedAt).toLocaleString("es-MX")}` : ""}`
              : saveState === "saving"
                ? "Guardando en nube..."
                : "Solo local (falta Guardar flujo)"}
          </p>
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

                          <div className="space-y-3 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                            <p className="text-sm text-neutral-300">Roll Color Labels (optional)</p>
                            <p className="text-xs text-neutral-500">
                              Agrega etiquetas manuales por rollo (A/B/C... o el código que uses) para llevar conteo y progreso real.
                            </p>

                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="text"
                                value={rollColorInput}
                                onChange={(event) => setRollColorInput(event.target.value)}
                                placeholder="Add manual label (ex: A, WT-3)"
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => addRollColorLabel(rollColorInput)}
                                className="rounded-xl border border-cyan-500 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={syncRollPlacementTotalsFromLabels}
                                disabled={rollColorLabels.length === 0}
                                className="rounded-xl border border-neutral-600 px-4 py-2 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
                              >
                                Sync Totals
                              </button>
                            </div>

                            {nextRollSuggestion && nextRollSuggestion.nextRolls.length > 0 ? (
                              <div className="space-y-2 rounded-xl border border-cyan-600/40 bg-cyan-500/5 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-semibold text-cyan-200">
                                    Next rolls ({nextRollSuggestion.strategy} · confidence {Math.round(nextRollSuggestion.confidence * 100)}%)
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setUseSerpentineSuggestions((prev) => !prev)}
                                    className="rounded-full border border-neutral-600 px-3 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                                  >
                                    {useSerpentineSuggestions ? "Serpentine ON" : "Serpentine OFF"}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {nextRollSuggestion.nextRolls.map((roll) => (
                                    <button
                                      key={roll.instanceId}
                                      type="button"
                                      onClick={() => addRollColorLabel(roll.id)}
                                      className="rounded-full border border-cyan-500/70 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                                    >
                                      + {roll.id}
                                      {roll.lengthFt ? ` · ${roll.lengthFt}ft` : ""}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {planSuggestedRolls.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs text-cyan-300">
                                  Sugeridos por plano para esta zona (opcional):
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const parsedCurrent = Number.parseInt(totalRollsUsed, 10)
                                      const baseline = Number.isFinite(parsedCurrent) ? parsedCurrent : 0
                                      setTotalRollsUsed(String(Math.max(baseline, planSuggestedRolls.length)))
                                    }}
                                    className="rounded-full border border-neutral-600 px-3 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                                  >
                                    Usar conteo sugerido ({planSuggestedRolls.length})
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {planSuggestedRolls.map((roll) => (
                                    <button
                                      key={roll.label}
                                      type="button"
                                      onClick={() => addRollColorLabel(roll.label)}
                                      className="rounded-full border border-cyan-500/60 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                                    >
                                      + {roll.label}
                                      {roll.totalLinearFt ? ` · ${roll.totalLinearFt}ft` : ""}
                                      {roll.chopCount > 0 ? ` · CH${roll.chopCount}` : ""}
                                      {roll.splitCount > 0 ? ` · SP${roll.splitCount}` : ""}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {rollColorLabels.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {rollColorLabels.map((label) => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => removeRollColorLabel(label)}
                                    className="rounded-full border border-cyan-500/70 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                                  >
                                    {label} ×
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-500">Sin labels capturados.</p>
                            )}

                            <div className="space-y-1">
                              <p className="text-xs text-neutral-400">
                                Capturados: {rollColorLabels.length} rollos · Costuras sugeridas para Sewing: {Math.max(rollColorLabels.length - 1, 0)}
                              </p>
                              {rollLabelProgress !== null ? (
                                <>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                                    <div
                                      className="h-full rounded-full bg-cyan-500 transition-all"
                                      style={{ width: `${rollLabelProgress}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-cyan-200">Progreso vs Total Rolls: {rollLabelProgress}%</p>
                                </>
                              ) : null}
                            </div>
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
                            <div className="rounded-xl border border-neutral-700 px-3 py-3 text-center text-xs text-neutral-400">
                              Roll Placement se guarda con Guardar flujo
                            </div>
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

                          <p className="rounded-xl border border-neutral-700 px-3 py-3 text-center text-xs text-neutral-400">
                            Adhesive se guarda con Guardar flujo
                          </p>

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
                                <div className="w-full rounded-xl border border-neutral-700 px-3 py-3 text-center text-xs text-neutral-400">
                                  Material se guarda con Guardar flujo
                                </div>
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

                      {step.key === "SEWING" ? (
                        <>
                          <p className="text-sm text-neutral-300">Cuestionario de Sewing (inline).</p>
                          <label className="block space-y-2">
                            <span className="text-sm text-neutral-300">Total Seams</span>
                            <input
                              type="number"
                              min={0}
                              value={sewingTotalSeams}
                              onChange={(event) => setSewingTotalSeams(event.target.value)}
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                            />
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm text-neutral-300">Nota rápida (opcional)</span>
                            <textarea
                              rows={2}
                              value={quickNotes[step.key] ?? ""}
                              onChange={(event) => setQuickNotes((prev) => ({ ...prev, [step.key]: event.target.value }))}
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                            />
                          </label>

                          <p className="rounded-xl border border-neutral-700 px-3 py-3 text-center text-xs text-neutral-400">
                            Sewing se guarda con Guardar flujo
                          </p>

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

                      {step.key !== "ROLL_PLACEMENT" && step.key !== "ADHESIVE" && step.key !== "MATERIAL" && step.key !== "SEWING" ? (
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
                          <p className="rounded-xl border border-neutral-700 px-3 py-3 text-center text-xs text-neutral-400">
                            Este paso se guarda con Guardar flujo
                          </p>
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

          <div className={`space-y-2 rounded-xl border border-neutral-700 bg-neutral-950 p-3 ${canOpenProcesses ? "" : "opacity-60"}`}>
            <p className="text-xs text-neutral-400">
              Fases marcadas: {zone.completedStepKeys.length > 0 ? zone.completedStepKeys.join(", ") : "ninguna"}
            </p>
            <button
              type="button"
              onClick={() => void submitFlowSession()}
              disabled={!canOpenProcesses || isSavingFlow}
              className="w-full rounded-xl bg-cyan-600 py-3 font-semibold hover:bg-cyan-700 disabled:opacity-50"
            >
              {isSavingFlow ? "Guardando flujo..." : "Guardar flujo"}
            </button>
            {flowError ? (
              <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">{flowError}</p>
            ) : null}
            {flowMessage ? (
              <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">{flowMessage}</p>
            ) : null}
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
