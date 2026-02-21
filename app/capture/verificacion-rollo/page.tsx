"use client"

export const dynamic = "force-dynamic"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChangeEvent, Suspense, useMemo, useState } from "react"

import { FieldTypeSelector } from "../../../components/shared/FieldTypeSelector"
import { IMAGE_INPUT_ACCEPT, processImageFile } from "../../../lib/clientImage"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"
import { MacroZone, getMacroZoneOptions, getMicroZoneOptions } from "../../../types/zoneHierarchy"

type VerificationStatus = "pending" | "confirmed" | "rejected"

export default function RollVerificationPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">Cargando Verificación...</main>}>
      <RollVerificationPageContent />
    </Suspense>
  )
}

function RollVerificationPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")

  const [fieldType, setFieldType] = useState<FieldType>(() => (projectId ? readProjectFieldType(projectId) : "football"))
  const [macroZone, setMacroZone] = useState<MacroZone | "">("")
  const [microZone, setMicroZone] = useState("")
  const [rollColor, setRollColor] = useState("")
  const [rollFeetTotal, setRollFeetTotal] = useState("")
  const [rollLotId, setRollLotId] = useState("")
  const [labelPhoto, setLabelPhoto] = useState<string | null>(null)
  const [status, setStatus] = useState<VerificationStatus>("pending")
  const [rejectionReason, setRejectionReason] = useState("")
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")

  const microOptions = useMemo(() => {
    if (!macroZone) return []
    return getMicroZoneOptions(fieldType, macroZone)
  }, [fieldType, macroZone])
  const macroZoneOptions = useMemo(() => getMacroZoneOptions(fieldType), [fieldType])

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError("")
    setIsUploadingPhoto(true)
    try {
      const dataUrl = await processImageFile(file)
      setLabelPhoto(dataUrl)
    } catch {
      setError("No se pudo cargar la foto de etiqueta.")
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  async function handleSubmit() {
    if (!projectId) return setError("Selecciona proyecto antes de verificar.")
    if (!macroZone) return setError("MacroZone es requerida.")
    if (!microZone) return setError("MicroZone es requerida.")
    if (!rollColor.trim()) return setError("Color del rollo es requerido.")
    if (!rollFeetTotal || Number(rollFeetTotal) <= 0) return setError("Pies del rollo deben ser mayores a 0.")
    if (!labelPhoto) return setError("Foto de etiqueta es requerida.")
    if (status === "rejected" && !rejectionReason.trim()) {
      return setError("Motivo de rechazo es obligatorio.")
    }

    setIsSubmitting(true)
    setError("")
    setSaveMessage("")

    try {
      const response = await fetch("/api/roll-verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          field_type: fieldType,
          macro_zone: macroZone,
          micro_zone: microZone,
          roll_color: rollColor.trim(),
          roll_feet_total: Number(rollFeetTotal),
          roll_lot_id: rollLotId.trim() || undefined,
          label_photo: labelPhoto,
          status,
          rejection_reason: status === "rejected" ? rejectionReason.trim() : undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar verificación")
      }

      console.log("[roll-verification] save_success", { id: data.id, projectId, status })
      setSaveMessage("Verificación guardada en nube.")
      setMacroZone("")
      setMicroZone("")
      setRollColor("")
      setRollFeetTotal("")
      setRollLotId("")
      setLabelPhoto(null)
      setStatus("pending")
      setRejectionReason("")
    } catch (err) {
      console.error("[roll-verification] save_failed", {
        projectId,
        error: err instanceof Error ? err.message : "unknown_error",
      })
      setError(err instanceof Error ? err.message : "Error al guardar.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleFieldTypeChange(next: FieldType) {
    if (!projectId) return
    setFieldType(next)
    saveProjectFieldType(projectId, next)
    setMacroZone("")
    setMicroZone("")
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de usar Verificación de Rollo.</p>
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
          <p className="text-sm text-neutral-400">Pulse / Verificación de Rollo / {projectId}</p>
          <h1 className="text-3xl font-bold">Verificación de Rollo</h1>
          <p className="text-neutral-300">Control previo antes de instalación.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Color del rollo</span>
              <input
                type="text"
                value={rollColor}
                onChange={(event) => setRollColor(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Pies del rollo</span>
              <input
                type="number"
                min={0}
                value={rollFeetTotal}
                onChange={(event) => setRollFeetTotal(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Lote / ID (opcional)</span>
            <input
              type="text"
              value={rollLotId}
              onChange={(event) => setRollLotId(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Foto etiqueta (obligatoria)</span>
            <input
              type="file"
              accept={IMAGE_INPUT_ACCEPT}
              onChange={handlePhotoChange}
              className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
            />
          </label>

          {labelPhoto ? (
            <Image
              src={labelPhoto}
              alt="Etiqueta del rollo"
              width={1000}
              height={700}
              unoptimized
              className="h-56 w-full rounded-xl border border-neutral-700 object-cover"
            />
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Estado de verificación</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: "pending", label: "Enviar a verificación" },
                { value: "confirmed", label: "Confirmar rollo" },
                { value: "rejected", label: "Rechazar rollo" },
              ].map((option) => {
                const active = status === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatus(option.value as VerificationStatus)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      active ? "border-blue-500 bg-blue-500/20 text-blue-200" : "border-neutral-700 bg-neutral-950"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {status === "rejected" ? (
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Motivo de rechazo (obligatorio)</span>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingPhoto}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Guardar Verificación
            </button>
            <Link
              href={`/capture?project=${encodeURIComponent(projectId)}`}
              className="w-full rounded-xl border border-neutral-600 py-3 text-center font-semibold hover:bg-neutral-800"
            >
              Volver al Hub
            </Link>
          </div>

          {saveMessage ? <p className="text-sm text-emerald-300">{saveMessage}</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </section>
      </section>
    </main>
  )
}
