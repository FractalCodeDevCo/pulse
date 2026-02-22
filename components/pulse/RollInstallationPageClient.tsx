"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, useEffect, useState } from "react"

import { createCaptureSessionId } from "../../lib/captureSession"
import { IMAGE_INPUT_ACCEPT, processImageFile } from "../../lib/clientImage"
import { readZonePhotosCache } from "../../lib/zonePhotoCache"
import { PULSE_ZONE_OPTIONS, PulseZone } from "../../types/pulseZones"
import ContextHeader from "./ContextHeader"

type FitStatus = "green" | "yellow" | "red"
type CompactionMethod = "Plate" | "Roller" | "Manual"
type PhotoType = "compacting" | "in_progress" | "completed"

type RollInstallationPageClientProps = {
  projectId: string | null
  projectZoneId: string | null
  fieldType: string | null
  macroZone: string | null
  microZone: string | null
  zoneType: string | null
  prefillFromZone: boolean
}

type PhotoState = Record<PhotoType, string | null>

const PHOTO_LABELS: Record<PhotoType, string> = {
  compacting: "Compacting",
  in_progress: "In Progress",
  completed: "Completed",
}

const INITIAL_PHOTOS: PhotoState = {
  compacting: null,
  in_progress: null,
  completed: null,
}

export default function RollInstallationPageClient({
  projectId,
  projectZoneId,
  fieldType,
  macroZone,
  microZone,
  zoneType,
  prefillFromZone,
}: RollInstallationPageClientProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [photos, setPhotos] = useState<PhotoState>(INITIAL_PHOTOS)
  const [zone, setZone] = useState<PulseZone | "">((microZone as PulseZone | null) ?? "")
  const [fit, setFit] = useState<FitStatus | "">("")
  const [totalRollsUsed, setTotalRollsUsed] = useState("")
  const [totalSeams, setTotalSeams] = useState("")
  const [surfaceFirm, setSurfaceFirm] = useState(true)
  const [moistureOk, setMoistureOk] = useState(true)
  const [doubleCompaction, setDoubleCompaction] = useState(false)
  const [compactionMethod, setCompactionMethod] = useState<CompactionMethod | "">("")
  const [captureSessionId, setCaptureSessionId] = useState(() => createCaptureSessionId())
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const backToZoneOrHub =
    projectId && projectZoneId
      ? `/pulse/zones/${encodeURIComponent(projectZoneId)}?project=${encodeURIComponent(projectId)}`
      : `/pulse?project=${encodeURIComponent(projectId ?? "")}`
  const uiStep = step === 3 ? 2 : step

  useEffect(() => {
    if (!prefillFromZone || !projectId || !projectZoneId) return

    const cached = readZonePhotosCache(projectId, projectZoneId)
    if (cached.length < 3) {
      setError("No encontramos fotos de zona en caché. Vuelve a Paso 1 de la zona y sube fotos.")
      return
    }

    setPhotos({
      compacting: cached[0] ?? null,
      in_progress: cached[1] ?? null,
      completed: cached[2] ?? null,
    })
    setStep(2)
  }, [prefillFromZone, projectId, projectZoneId])

  async function handlePhotoChange(type: PhotoType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError("")
    setIsReadingPhoto(true)

    try {
      const dataUrl = await processImageFile(file)
      setPhotos((prev) => ({ ...prev, [type]: dataUrl }))
    } catch {
      setError("No se pudo cargar la foto.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function hasAllPhotos() {
    return Boolean(photos.compacting && photos.in_progress && photos.completed)
  }

  async function submit() {
    if (!zone) return setError("Zone is required.")
    if (!fit) return setError("Roll length fit is required.")
    if (!totalRollsUsed || Number(totalRollsUsed) < 0) return setError("Total rolls used is required.")
    if (!totalSeams || Number(totalSeams) < 0) return setError("Total seams is required.")
    if (!compactionMethod) return setError("Compaction method is required.")
    if (!hasAllPhotos()) return setError("3 photos are required.")

    setError("")
    setIsSubmitting(true)
    setSuccess("")

    try {
      const response = await fetch("/api/roll-installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          project_zone_id: projectZoneId,
          field_type: fieldType,
          macro_zone: macroZone,
          micro_zone: microZone,
          zone_type: zoneType,
          zone,
          roll_length_fit: fit,
          total_rolls_used: Number(totalRollsUsed),
          total_seams: Number(totalSeams),
          compaction_surface_firm: surfaceFirm,
          compaction_moisture_ok: moistureOk,
          compaction_double: doubleCompaction,
          compaction_method: compactionMethod,
          capture_session_id: captureSessionId,
          capture_status: "complete",
          photos,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? "Save failed")

      setSuccess("Roll installation saved.")
      setCaptureSessionId(createCaptureSessionId())
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Select a project first.</p>
        <Link href="/projects?flow=load" className="rounded-xl bg-blue-600 px-4 py-3 font-semibold">
          Go to Projects
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <ContextHeader
          title="Roll Installation"
          subtitle="Captura rápida de instalación de rollo."
          backHref={backToZoneOrHub}
          backLabel={projectZoneId ? "Zona" : "Proyecto"}
          breadcrumbs={[
            { label: "Pulse", href: "/" },
            projectId ? { label: projectId, href: `/pulse?project=${encodeURIComponent(projectId)}` } : { label: "Proyecto" },
            { label: "Roll Installation" },
          ]}
          projectLabel={projectId}
          zoneLabel={macroZone && microZone ? `${macroZone} / ${microZone}` : null}
          statusLabel={step === 3 ? "Completado" : `Paso ${uiStep}/2`}
          dateLabel={new Date().toLocaleDateString("es-MX")}
        />

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Step {uiStep} of 2
        </div>

        {step === 1 ? (
          <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">Required Photos</h2>
            {(["compacting", "in_progress", "completed"] as PhotoType[]).map((type) => (
              <label key={type} className="block space-y-2">
                <span className="text-sm text-neutral-300">{PHOTO_LABELS[type]}</span>
                <input
                  type="file"
                  accept={IMAGE_INPUT_ACCEPT}
                  onChange={(event) => void handlePhotoChange(type, event)}
                  className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
                />
                {photos[type] ? (
                  <Image
                    src={photos[type] as string}
                    alt={PHOTO_LABELS[type]}
                    width={1000}
                    height={700}
                    unoptimized
                    className="h-48 w-full rounded-xl border border-neutral-700 object-cover"
                  />
                ) : null}
              </label>
            ))}

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!hasAllPhotos() || isReadingPhoto}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              Continue
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            {prefillFromZone ? (
              <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Fotos cargadas desde Paso 1 de la zona.
              </p>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Zone</span>
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value as PulseZone | "")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              >
                <option value="">Select zone</option>
                {PULSE_ZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Roll Length Fit</span>
              <select
                value={fit}
                onChange={(event) => setFit(event.target.value as FitStatus | "")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              >
                <option value="">Select status</option>
                <option value="green">Green - Normal</option>
                <option value="yellow">Yellow - Justo</option>
                <option value="red">Red - Falta/Sobra demasiado</option>
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-neutral-300">Total Rolls Used</span>
                <input
                  type="number"
                  min={0}
                  value={totalRollsUsed}
                  onChange={(event) => setTotalRollsUsed(event.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-neutral-300">Total Seams</span>
                <input
                  type="number"
                  min={0}
                  value={totalSeams}
                  onChange={(event) => setTotalSeams(event.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Compaction Method</span>
              <select
                value={compactionMethod}
                onChange={(event) => setCompactionMethod(event.target.value as CompactionMethod | "")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              >
                <option value="">Select method</option>
                <option value="Plate">Plate</option>
                <option value="Roller">Roller</option>
                <option value="Manual">Manual</option>
              </select>
            </label>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSurfaceFirm((prev) => !prev)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold ${surfaceFirm ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"}`}
              >
                Surface Firm: {surfaceFirm ? "Yes" : "No"}
              </button>
              <button
                type="button"
                onClick={() => setMoistureOk((prev) => !prev)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold ${moistureOk ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"}`}
              >
                Moisture OK: {moistureOk ? "Yes" : "No"}
              </button>
              <button
                type="button"
                onClick={() => setDoubleCompaction((prev) => !prev)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold ${doubleCompaction ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"}`}
              >
                Double: {doubleCompaction ? "Yes" : "No"}
              </button>
            </div>

            <div className={`grid gap-2 ${prefillFromZone ? "" : "sm:grid-cols-2"}`}>
              {!prefillFromZone ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800"
                >
                  Back to Photos
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3 rounded-2xl border border-emerald-600/60 bg-emerald-500/10 p-5">
            <p className="font-semibold text-emerald-200">{success}</p>
            <Link
              href={backToZoneOrHub}
              className="block w-full rounded-xl bg-blue-600 py-3 text-center font-semibold hover:bg-blue-700"
            >
              Back
            </Link>
          </section>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
        ) : null}
      </section>
    </main>
  )
}
