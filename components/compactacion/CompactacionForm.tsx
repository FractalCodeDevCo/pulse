"use client"

import Image from "next/image"
import { ChangeEvent, FormEvent, useMemo, useState } from "react"

import {
  CompactacionFormValues,
  CompactacionRecord,
  CompactacionType,
  TrafficLightStatus,
} from "../../types/compactacion"
import { IMAGE_INPUT_ACCEPT } from "../../lib/clientImage"
import { FieldType } from "../../types/fieldType"
import { Zone } from "../../types/zones"
import { ZoneSelect } from "../shared/ZoneSelect"

const INITIAL_VALUES: CompactacionFormValues = {
  zone: "",
  compactacionType: CompactacionType.GENERAL,
  directionAlignedToRolls: true,
  surfaceFirm: true,
  moistureOk: true,
  trafficLightStatus: "",
  photos: [],
  observations: "",
  crewId: "",
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

type CompactacionFormProps = {
  fieldType: FieldType
  projectId: string
  defaultZone?: Zone | ""
  onSubmitRecord: (record: CompactacionRecord) => Promise<void> | void
}

export function CompactacionForm({
  fieldType,
  projectId,
  defaultZone = "",
  onSubmitRecord,
}: CompactacionFormProps) {
  const [values, setValues] = useState<CompactacionFormValues>({ ...INITIAL_VALUES, zone: defaultZone })
  const [error, setError] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return Boolean(values.zone && values.compactacionType && values.trafficLightStatus && values.crewId.trim())
  }, [values])

  async function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError("")
    setIsReadingPhoto(true)

    try {
      const selected = Array.from(files).slice(0, 2)
      const urls = await Promise.all(selected.map((file) => readAsDataUrl(file)))
      setValues((prev) => ({ ...prev, photos: urls }))
    } catch {
      setError("No pudimos cargar las fotos.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function removePhoto(index: number) {
    setValues((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.zone) return setError("Zona requerida.")
    if (!values.compactacionType) return setError("Tipo de compactación requerido.")
    if (!values.trafficLightStatus) return setError("Semáforo requerido.")
    if (values.photos.length < 1 || values.photos.length > 2) return setError("Sube 1 o 2 fotos.")
    if (!values.crewId.trim()) return setError("Crew ID requerido.")

    const record: CompactacionRecord = {
      projectId,
      fieldType,
      zone: values.zone as Zone,
      compactacionType: values.compactacionType as CompactacionType,
      directionAlignedToRolls: values.directionAlignedToRolls,
      surfaceFirm: values.surfaceFirm,
      moistureOk: values.moistureOk,
      trafficLightStatus: values.trafficLightStatus as TrafficLightStatus,
      photos: values.photos,
      observations: values.observations.trim() || undefined,
      crewId: values.crewId.trim(),
      timestamp: new Date().toISOString(),
    }

    setIsSubmitting(true)
    setError("")

    try {
      await onSubmitRecord(record)
      setValues({ ...INITIAL_VALUES, zone: defaultZone })
    } catch {
      setError("No se pudo guardar en nube. Queda respaldo local.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <ZoneSelect
        label="Zona"
        value={values.zone}
        onChange={(zone) => setValues((prev) => ({ ...prev, zone }))}
      />

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Tipo de compactación</span>
        <select
          value={values.compactacionType}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, compactacionType: event.target.value as CompactacionType | "" }))
          }
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          required
        >
          <option value={CompactacionType.GENERAL}>General</option>
          <option value={CompactacionType.AJUSTE}>Ajuste</option>
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setValues((prev) => ({ ...prev, directionAlignedToRolls: !prev.directionAlignedToRolls }))}
          className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
            values.directionAlignedToRolls
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
              : "border-neutral-700 bg-neutral-900"
          }`}
        >
          Dirección alineada: {values.directionAlignedToRolls ? "Sí" : "No"}
        </button>

        <button
          type="button"
          onClick={() => setValues((prev) => ({ ...prev, surfaceFirm: !prev.surfaceFirm }))}
          className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
            values.surfaceFirm
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
              : "border-neutral-700 bg-neutral-900"
          }`}
        >
          Superficie firme: {values.surfaceFirm ? "Sí" : "No"}
        </button>

        <button
          type="button"
          onClick={() => setValues((prev) => ({ ...prev, moistureOk: !prev.moistureOk }))}
          className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
            values.moistureOk
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
              : "border-neutral-700 bg-neutral-900"
          }`}
        >
          Humedad ok: {values.moistureOk ? "Sí" : "No"}
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-neutral-300">Semáforo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { value: TrafficLightStatus.GREEN, label: "Green", cls: "border-emerald-500 text-emerald-200" },
            { value: TrafficLightStatus.YELLOW, label: "Yellow", cls: "border-amber-500 text-amber-200" },
            { value: TrafficLightStatus.RED, label: "Red", cls: "border-red-500 text-red-200" },
          ].map((option) => {
            const active = values.trafficLightStatus === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setValues((prev) => ({ ...prev, trafficLightStatus: option.value as TrafficLightStatus }))
                }
                className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
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
        <span className="text-sm text-neutral-300">Fotos (1 a 2)</span>
        <input
          type="file"
          accept={IMAGE_INPUT_ACCEPT}
          multiple
          onChange={handlePhotosChange}
          className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
          required
        />
      </label>

      {values.photos.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {values.photos.map((photo, index) => (
            <div key={photo} className="space-y-2">
              <Image
                src={photo}
                alt={`Compactacion ${index + 1}`}
                width={600}
                height={400}
                unoptimized
                className="h-32 w-full rounded-xl border border-neutral-700 object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="w-full rounded-lg border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Crew ID</span>
          <input
            type="text"
            value={values.crewId}
            onChange={(event) => setValues((prev) => ({ ...prev, crewId: event.target.value }))}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
          <textarea
            rows={3}
            value={values.observations}
            onChange={(event) => setValues((prev) => ({ ...prev, observations: event.target.value }))}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit || isReadingPhoto || isSubmitting}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        Guardar Compactación
      </button>
    </form>
  )
}
