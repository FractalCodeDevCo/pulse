"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, useEffect, useMemo, useState } from "react"

import { createCaptureSessionId } from "../../lib/captureSession"
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

const CONDITION_OPTIONS = ["Excelente", "Buena", "Regular", "Mala"]
const CLIMATE_OPTIONS = ["Soleado", "Nublado", "Lluvioso", "Viento", "Humedad alta"]
const BEIS_SOFT_CRITICAL_AREAS = [
  "Batter Box",
  "Pitcher Mound",
  "Coach Zones",
  "Línea del corredor",
] as const
const LINEAS_MARKBOX = "Lineas"

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

  const stepTemplates = useMemo(() => (zone ? getZoneStepTemplates(zone.zoneType) : []), [zone])
  const progress = zone ? getZoneProgress(zone) : 0
  const canOpenProcesses = zonePhotos.length > 0
  const isBeisSoftInfield =
    zone?.macroZone === "Infield" && (zone.fieldType === "beisbol" || zone.fieldType === "softbol")
  const canShowLineasMarkbox =
    zone?.fieldType === "beisbol" ||
    zone?.fieldType === "softbol" ||
    zone?.fieldType === "football" ||
    zone?.fieldType === "soccer"
  const isCriticalInfieldSelection = isBeisSoftInfield && adhesiveCriticalInfieldAreas.length > 0

  useEffect(() => {
    if (!projectId || !zone) return
    saveZonePhotosCache(projectId, zone.id, zonePhotos)
  }, [projectId, zone, zonePhotos])

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

  async function submitRollPlacementInline() {
    if (!projectId || !zone) return
    if (!rollLengthFit) return setRollPlacementError("Roll length fit es requerido.")
    if (!totalRollsUsed || Number(totalRollsUsed) < 0) return setRollPlacementError("Total rolls es requerido.")
    if (!totalSeams || Number(totalSeams) < 0) return setRollPlacementError("Total seams es requerido.")
    if (!compactionMethod) return setRollPlacementError("Compaction method es requerido.")

    const compactingPhoto = zonePhotos[0] ?? null
    const inProgressPhoto = zonePhotos[1] ?? null
    const completedPhoto = zonePhotos[2] ?? null

    if (!compactingPhoto || !inProgressPhoto || !completedPhoto) {
      return setRollPlacementError("Necesitas 3 fotos de zona para Roll Placement.")
    }

    setRollPlacementError("")
    setRollPlacementMessage("")
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
          roll_length_fit: rollLengthFit,
          total_rolls_used: Number(totalRollsUsed),
          total_seams: Number(totalSeams),
          compaction_surface_firm: surfaceFirm,
          compaction_moisture_ok: moistureOk,
          compaction_double: doubleCompaction,
          compaction_method: compactionMethod,
          capture_session_id: rollPlacementSessionId,
          capture_status: "complete",
          photos: {
            compacting: compactingPhoto,
            in_progress: inProgressPhoto,
            completed: completedPhoto,
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar Roll Placement")

      setRollPlacementMessage("Roll Placement guardado.")
      setRollPlacementSessionId(createCaptureSessionId())
      if (!zone.completedStepKeys.includes("ROLL_PLACEMENT")) toggleStep("ROLL_PLACEMENT")
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
    if (!isCriticalInfieldSelection && (!adhesiveFt || Number(adhesiveFt) <= 0)) {
      return setAdhesiveError("Ft Totales debe ser mayor a 0.")
    }

    const prep = zonePhotos[0] ?? null
    const antes = zonePhotos[1] ?? null
    const despues = zonePhotos[2] ?? null
    if (!prep || !antes || !despues) {
      return setAdhesiveError("Para Adhesive necesitas 3 fotos de zona (Prep, Antes, Después).")
    }

    setAdhesiveError("")
    setAdhesiveMessage("")
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
            critical_infield_area: isCriticalInfieldSelection ? adhesiveCriticalInfieldAreas[0] : undefined,
            critical_infield_areas: isCriticalInfieldSelection ? adhesiveCriticalInfieldAreas : undefined,
            markbox: adhesiveLineasMarkbox ? LINEAS_MARKBOX : undefined,
            ftTotales: isCriticalInfieldSelection ? 10 : Number(adhesiveFt),
            botesUsados: Number(adhesiveBotes),
            condicion: adhesiveCondicion,
            clima: adhesiveClima,
            observaciones: adhesiveObservaciones.trim(),
            capture_session_id: adhesiveSessionId,
            capture_status: "complete",
            evidencePhotos: { prep, antes, despues },
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar Adhesive")

      setAdhesiveMessage("Adhesive (Pegada) guardado.")
      setAdhesiveSessionId(createCaptureSessionId())
      if (!zone.completedStepKeys.includes("ADHESIVE")) toggleStep("ADHESIVE")
    } catch (err) {
      setAdhesiveError(err instanceof Error ? err.message : "Error al guardar Adhesive.")
    } finally {
      setIsSavingAdhesive(false)
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
          <p className="text-sm text-neutral-400">Compaction → Roll Placement → Sewing → Cut → Adhesive.</p>

          <div className={canOpenProcesses ? "space-y-2" : "pointer-events-none space-y-2 opacity-50"}>
            {stepTemplates.map((step) => {
              const completed = zone.completedStepKeys.includes(step.key)
              const expanded = openStep === step.key
              const shouldAutoExpand = step.key === "ROLL_PLACEMENT" || step.key === "ADHESIVE"

              return (
                <div key={step.key} className="rounded-xl border border-neutral-700 bg-neutral-950">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (shouldAutoExpand) setOpenStep(step.key)
                      }}
                      className={`text-left ${shouldAutoExpand ? "cursor-pointer" : "cursor-default"}`}
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
                            Usa las primeras 3 fotos de zona (Compacting, In Progress y Completed).
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
                        </>
                      ) : null}

                      {step.key === "ADHESIVE" ? (
                        <>
                          <p className="text-sm text-neutral-300">Metadata de Adhesive (Pegada) inline.</p>

                          {isBeisSoftInfield ? (
                            <fieldset className="space-y-2">
                              <legend className="text-sm text-neutral-300">Zona crítica (opción múltiple)</legend>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {BEIS_SOFT_CRITICAL_AREAS.map((item) => {
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
                              <p className="text-xs text-neutral-400">Puedes seleccionar varias. Si eliges al menos una, Ft Totales se desactiva.</p>
                            </fieldset>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-sm text-neutral-300">
                                Ft Totales ({isCriticalInfieldSelection ? "fijo por zona crítica" : adhesiveFt || 0})
                              </span>
                              <input
                                type="range"
                                min={1}
                                max={500}
                                value={adhesiveFt}
                                onChange={(event) => setAdhesiveFt(event.target.value)}
                                disabled={isCriticalInfieldSelection}
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

                          {canShowLineasMarkbox ? (
                            <fieldset className="space-y-2">
                              <legend className="text-sm text-neutral-300">Markbox adicional</legend>
                              <button
                                type="button"
                                onClick={() => setAdhesiveLineasMarkbox((prev) => !prev)}
                                className={`w-full rounded-xl border px-3 py-3 text-sm font-semibold ${
                                  adhesiveLineasMarkbox
                                    ? "border-blue-500 bg-blue-500/20 text-blue-200"
                                    : "border-neutral-700 bg-neutral-900"
                                }`}
                              >
                                {LINEAS_MARKBOX}
                              </button>
                              <p className="text-xs text-neutral-400">Este botón no modifica Ft Totales.</p>
                            </fieldset>
                          ) : null}

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
                        </>
                      ) : null}

                      {step.key !== "ROLL_PLACEMENT" && step.key !== "ADHESIVE" ? (
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
