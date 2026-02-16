"use client"

import Image from "next/image"
import { ChangeEvent, FormEvent, useMemo, useState } from "react"

import { FieldType } from "../../types/fieldType"
import { RollosFormValues, RollosRecord, ZoneRollosStatus } from "../../types/rollos"
import { Zone } from "../../types/zones"
import { ZoneSelect } from "../shared/ZoneSelect"

const INITIAL_VALUES: RollosFormValues = {
  zone: "",
  totalRollsInstalled: "",
  seamsCompleted: "",
  wasteEstimated: "",
  zoneStatus: "",
  generalPhotos: [],
  observations: "",
  crewId: "",
}

const ZONE_STATUS_OPTIONS: Array<{ value: ZoneRollosStatus; label: string }> = [
  { value: ZoneRollosStatus.IN_PROGRESS, label: "In Progress" },
  { value: ZoneRollosStatus.COMPLETED, label: "Completed" },
]

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
  onSubmitRecord: (record: RollosRecord) => Promise<void> | void
}

export function RollosForm({ fieldType, projectId, defaultZone = "", onSubmitRecord }: RollosFormProps) {
  const [values, setValues] = useState<RollosFormValues>({ ...INITIAL_VALUES, zone: defaultZone })
  const [error, setError] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return Boolean(
      values.zone &&
        values.totalRollsInstalled &&
        values.seamsCompleted &&
        values.zoneStatus &&
        values.crewId.trim() &&
        values.generalPhotos.length >= 1,
    )
  }, [values])

  async function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError("")
    setIsReadingPhoto(true)

    try {
      const selected = Array.from(files).slice(0, 3)
      const urls = await Promise.all(selected.map((file) => readAsDataUrl(file)))
      setValues((prev) => ({ ...prev, generalPhotos: urls }))
    } catch {
      setError("No pudimos cargar las fotos.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function removePhoto(index: number) {
    setValues((prev) => ({
      ...prev,
      generalPhotos: prev.generalPhotos.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.zone) return setError("Zona requerida.")
    if (!values.totalRollsInstalled || Number(values.totalRollsInstalled) < 0) {
      return setError("Total de rollos instalado requerido.")
    }
    if (!values.seamsCompleted || Number(values.seamsCompleted) < 0) {
      return setError("Seams completed requerido.")
    }
    if (!values.zoneStatus) return setError("Estatus de zona requerido.")
    if (values.generalPhotos.length < 1 || values.generalPhotos.length > 3) {
      return setError("Sube de 1 a 3 fotos generales.")
    }
    if (!values.crewId.trim()) return setError("Crew ID requerido.")

    const waste = values.wasteEstimated.trim()

    const record: RollosRecord = {
      projectId,
      fieldType,
      zone: values.zone as Zone,
      totalRollsInstalled: Number(values.totalRollsInstalled),
      seamsCompleted: Number(values.seamsCompleted),
      wasteEstimated: waste ? Number(waste) : undefined,
      zoneStatus: values.zoneStatus as ZoneRollosStatus,
      generalPhotos: values.generalPhotos,
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Total de rollos instalados</span>
          <input
            type="number"
            min={0}
            value={values.totalRollsInstalled}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, totalRollsInstalled: event.target.value }))
            }
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Seams completed</span>
          <input
            type="number"
            min={0}
            value={values.seamsCompleted}
            onChange={(event) => setValues((prev) => ({ ...prev, seamsCompleted: event.target.value }))}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Waste estimado (opcional)</span>
          <input
            type="number"
            min={0}
            value={values.wasteEstimated}
            onChange={(event) => setValues((prev) => ({ ...prev, wasteEstimated: event.target.value }))}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          />
        </label>

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
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Estatus de zona</span>
        <select
          value={values.zoneStatus}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, zoneStatus: event.target.value as ZoneRollosStatus | "" }))
          }
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          required
        >
          <option value="">Selecciona estatus</option>
          {ZONE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Foto general (1 a 3)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handlePhotosChange}
          className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
          required
        />
      </label>

      {values.generalPhotos.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {values.generalPhotos.map((photo, index) => (
            <div key={photo} className="space-y-2">
              <Image
                src={photo}
                alt={`General ${index + 1}`}
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

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
        <textarea
          rows={3}
          value={values.observations}
          onChange={(event) => setValues((prev) => ({ ...prev, observations: event.target.value }))}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
        />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit || isReadingPhoto || isSubmitting}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        Guardar Rollos
      </button>
    </form>
  )
}
