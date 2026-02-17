"use client"

import Image from "next/image"
import { ChangeEvent, useMemo, useState } from "react"

import { FieldType } from "../../types/fieldType"
import {
  CompactionType,
  PhaseStatus,
  RollLengthStatus,
  RollosFormValues,
  RollosRecord,
} from "../../types/rollos"
import { Zone } from "../../types/zones"
import { ZoneSelect } from "../shared/ZoneSelect"

const INITIAL_VALUES: RollosFormValues = {
  zone: "",
  totalRolls: "",
  totalSeams: "",
  phaseStatus: "",
  compactionType: "",
  surfaceFirm: true,
  moistureOk: true,
  doubleCompaction: false,
  rollLengthStatus: "",
  photos: [],
  observations: "",
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

type RollosFormProps = {
  fieldType: FieldType
  projectId: string
  defaultZone?: Zone | ""
  onSubmitRecord: (record: RollosRecord, returnToHub: boolean) => Promise<void> | void
}

export function RollosForm({ fieldType, projectId, defaultZone = "", onSubmitRecord }: RollosFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [values, setValues] = useState<RollosFormValues>({ ...INITIAL_VALUES, zone: defaultZone })
  const [error, setError] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canContinue = values.photos.length >= 3

  const canSubmit = useMemo(() => {
    return Boolean(
      values.zone &&
        values.totalRolls &&
        values.totalSeams &&
        values.phaseStatus &&
        values.compactionType &&
        values.rollLengthStatus &&
        values.photos.length >= 3,
    )
  }, [values])

  async function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError("")
    setIsReadingPhoto(true)

    try {
      const selected = Array.from(files)
      const urls = await Promise.all(selected.map((file) => readAsDataUrl(file)))
      setValues((prev) => ({ ...prev, photos: [...prev.photos, ...urls] }))
    } catch {
      setError("No pudimos cargar las fotos.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= values.photos.length) return
    const next = [...values.photos]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setValues((prev) => ({ ...prev, photos: next }))
  }

  function removePhoto(index: number) {
    setValues((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))
  }

  async function handleSave(returnToHub: boolean) {
    if (!values.zone) return setError("Zona requerida.")
    if (!values.totalRolls || Number(values.totalRolls) < 0) return setError("Total de rollos requerido.")
    if (!values.totalSeams || Number(values.totalSeams) < 0) return setError("Total de costuras requerido.")
    if (!values.phaseStatus) return setError("Estado de fase requerido.")
    if (!values.compactionType) return setError("Tipo de compactación requerido.")
    if (!values.rollLengthStatus) return setError("Semáforo requerido.")
    if (values.photos.length < 3) return setError("Mínimo 3 fotos requeridas.")

    const record: RollosRecord = {
      projectId,
      fieldType,
      zone: values.zone as Zone,
      totalRolls: Number(values.totalRolls),
      totalSeams: Number(values.totalSeams),
      phaseStatus: values.phaseStatus as PhaseStatus,
      compactionType: values.compactionType as CompactionType,
      surfaceFirm: values.surfaceFirm,
      moistureOk: values.moistureOk,
      doubleCompaction: values.doubleCompaction,
      rollLengthStatus: values.rollLengthStatus as RollLengthStatus,
      photos: values.photos,
      observations: values.observations.trim() || undefined,
      timestamp: new Date().toISOString(),
    }

    setIsSubmitting(true)
    setError("")

    try {
      await onSubmitRecord(record, returnToHub)
      if (!returnToHub) {
        setValues({ ...INITIAL_VALUES, zone: defaultZone })
        setStep(1)
      }
    } catch {
      setError("No se pudo guardar en nube. Queda respaldo local.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-300">
        Paso {step} de 2
      </div>

      {step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1) Fotos</h2>
          <p className="text-sm text-neutral-400">Mínimo 3 fotos requeridas. Puedes cargar más.</p>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosChange}
            className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
          />

          {values.photos.length > 0 ? (
            <div className="space-y-3">
              {values.photos.map((photo, index) => (
                <div key={`${photo}-${index}`} className="rounded-xl border border-neutral-700 p-3">
                  <Image
                    src={photo}
                    alt={`Evidencia ${index + 1}`}
                    width={1200}
                    height={700}
                    unoptimized
                    className="h-64 w-full rounded-lg object-cover"
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
            Continue to Data
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2) Unified Data</h2>

          <ZoneSelect label="Zona" value={values.zone} onChange={(zone) => setValues((prev) => ({ ...prev, zone }))} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Total rolls</span>
              <input
                type="number"
                min={0}
                value={values.totalRolls}
                onChange={(event) => setValues((prev) => ({ ...prev, totalRolls: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Total seams</span>
              <input
                type="number"
                min={0}
                value={values.totalSeams}
                onChange={(event) => setValues((prev) => ({ ...prev, totalSeams: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                required
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Phase Status</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: PhaseStatus.COMPACTING, label: "COMPACTING" },
                { value: PhaseStatus.IN_PROGRESS, label: "IN_PROGRESS" },
                { value: PhaseStatus.COMPLETED, label: "COMPLETED" },
              ].map((option) => {
                const active = values.phaseStatus === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, phaseStatus: option.value }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      active ? "border-blue-500 bg-blue-500/20 text-blue-200" : "border-neutral-700 bg-neutral-900"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Compaction Type</span>
            <select
              value={values.compactionType}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, compactionType: event.target.value as CompactionType | "" }))
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              required
            >
              <option value="">Selecciona</option>
              <option value={CompactionType.PLATE}>PLATE</option>
              <option value={CompactionType.ROLLER}>ROLLER</option>
              <option value={CompactionType.MANUAL}>MANUAL</option>
            </select>
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, surfaceFirm: !prev.surfaceFirm }))}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                values.surfaceFirm ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
              }`}
            >
              surfaceFirm: {values.surfaceFirm ? "true" : "false"}
            </button>

            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, moistureOk: !prev.moistureOk }))}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                values.moistureOk ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
              }`}
            >
              moistureOk: {values.moistureOk ? "true" : "false"}
            </button>

            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, doubleCompaction: !prev.doubleCompaction }))}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                values.doubleCompaction ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
              }`}
            >
              doubleCompaction: {values.doubleCompaction ? "true" : "false"}
            </button>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Roll Length Traffic Light</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: RollLengthStatus.NORMAL, label: "GREEN · Normal", cls: "border-emerald-500 text-emerald-200" },
                { value: RollLengthStatus.JUSTO, label: "YELLOW · Justo", cls: "border-amber-500 text-amber-200" },
                {
                  value: RollLengthStatus.MAJOR_MISMATCH,
                  label: "RED · Falta/Sobra",
                  cls: "border-red-500 text-red-200",
                },
              ].map((option) => {
                const active = values.rollLengthStatus === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, rollLengthStatus: option.value }))}
                    className={`rounded-xl border px-3 py-4 text-sm font-semibold ${
                      active ? `${option.cls} bg-neutral-950` : "border-neutral-700 bg-neutral-900"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Observations (optional)</span>
            <textarea
              rows={3}
              value={values.observations}
              onChange={(event) => setValues((prev) => ({ ...prev, observations: event.target.value }))}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={!canSubmit || isSubmitting}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={!canSubmit || isSubmitting}
              className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              Save & Return to Hub
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  )
}
