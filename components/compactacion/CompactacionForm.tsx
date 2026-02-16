"use client"

import Image from "next/image"
import { ChangeEvent, FormEvent, useState } from "react"

import {
  CompactacionFormValues,
  CompactacionRecord,
  CompactionMethod,
  LevelingStatus,
} from "../../types/compactacion"
import { FieldType } from "../../types/fieldType"
import { Zone } from "../../types/zones"
import { ZoneSelect } from "../shared/ZoneSelect"

const INITIAL_VALUES: CompactacionFormValues = {
  zone: "",
  compactionMethod: "",
  levelingVerified: "",
  notes: "",
  evidencePhoto: null,
}

const METHOD_OPTIONS: Array<{ value: CompactionMethod; label: string }> = [
  { value: CompactionMethod.PLACA, label: "Placa" },
  { value: CompactionMethod.RODILLO, label: "Rodillo" },
  { value: CompactionMethod.MANUAL, label: "Manual" },
]

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
  onSubmitRecord: (record: CompactacionRecord) => Promise<void> | void
}

export function CompactacionForm({ fieldType, onSubmitRecord }: CompactacionFormProps) {
  const [values, setValues] = useState<CompactacionFormValues>(INITIAL_VALUES)
  const [error, setError] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingPhoto(true)
    setError("")

    try {
      const evidencePhoto = await readAsDataUrl(file)
      setValues((prev) => ({ ...prev, evidencePhoto }))
    } catch {
      setError("Failed to load photo. Try again.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.zone) return setError("Zone is required.")
    if (!values.compactionMethod) return setError("Compaction method is required.")
    if (!values.levelingVerified) return setError("Leveling status is required.")
    if (!values.evidencePhoto) return setError("Evidence photo is required.")

    const record: CompactacionRecord = {
      fieldType,
      zone: values.zone as Zone,
      compactionMethod: values.compactionMethod as CompactionMethod,
      levelingVerified: values.levelingVerified as LevelingStatus,
      notes: values.notes.trim() || undefined,
      evidencePhoto: values.evidencePhoto,
      timestamp: new Date().toISOString(),
    }

    setIsSubmitting(true)
    setError("")

    try {
      await onSubmitRecord(record)
      setValues(INITIAL_VALUES)
    } catch {
      setError("Could not save record. Kept local backup.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <ZoneSelect value={values.zone} onChange={(zone) => setValues((prev) => ({ ...prev, zone }))} />

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Compaction Method</span>
        <select
          value={values.compactionMethod}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, compactionMethod: event.target.value as CompactionMethod | "" }))
          }
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          required
        >
          <option value="">Select method</option>
          {METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm text-neutral-300">Leveling Verified</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setValues((prev) => ({ ...prev, levelingVerified: LevelingStatus.SI }))}
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
              values.levelingVerified === LevelingStatus.SI
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-neutral-700 bg-neutral-900"
            }`}
          >
            Si (Bien)
          </button>
          <button
            type="button"
            onClick={() => setValues((prev) => ({ ...prev, levelingVerified: LevelingStatus.NO }))}
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
              values.levelingVerified === LevelingStatus.NO
                ? "border-amber-500 bg-amber-500/20 text-amber-200"
                : "border-neutral-700 bg-neutral-900"
            }`}
          >
            No (Le falta)
          </button>
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Notes (optional)</span>
        <textarea
          rows={3}
          value={values.notes}
          onChange={(event) => setValues((prev) => ({ ...prev, notes: event.target.value }))}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Evidence Photo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
          required
        />
      </label>

      {values.evidencePhoto ? (
        <div className="overflow-hidden rounded-xl border border-neutral-700">
          <Image
            src={values.evidencePhoto}
            alt="Evidence preview"
            width={960}
            height={540}
            unoptimized
            className="h-52 w-full object-cover"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={isReadingPhoto || isSubmitting}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        Save Compactacion
      </button>
    </form>
  )
}
