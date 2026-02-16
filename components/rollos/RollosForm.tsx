"use client"

import Image from "next/image"
import { ChangeEvent, FormEvent, useState } from "react"

import {
  RollosFormValues,
  RollosRecord,
  RollStatusSelection,
  TrafficLightStatus,
} from "../../types/rollos"
import { FieldType } from "../../types/fieldType"
import { Zone } from "../../types/zones"
import { ZoneSelect } from "../shared/ZoneSelect"

const STATUS_OPTIONS: Array<{ value: RollStatusSelection; label: string; helper: string }> = [
  { value: RollStatusSelection.JUSTO_NORMAL, label: "Justo / Normal", helper: "Normal" },
  { value: RollStatusSelection.FALTO, label: "Falto", helper: "Slight shortage" },
  { value: RollStatusSelection.SOBRO, label: "Sobro", helper: "Slight overage" },
  { value: RollStatusSelection.SOBRO_DEMASIADO, label: "Sobro demasiado", helper: "Strong overage" },
]

const INITIAL_VALUES: RollosFormValues = {
  zone: "",
  labelPhoto: null,
  installationPhoto: null,
  length: "",
  color: "",
  dyeLot: "",
  rollId: "",
  status: "",
  comments: "",
  manualOverride: false,
  certifiedRoll: undefined,
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

function mapStatusToTrafficLight(status: RollStatusSelection): TrafficLightStatus {
  if (status === RollStatusSelection.JUSTO_NORMAL) return TrafficLightStatus.GREEN
  if (status === RollStatusSelection.SOBRO_DEMASIADO) return TrafficLightStatus.RED
  return TrafficLightStatus.YELLOW
}

function simulateLabelExtraction(fileName: string): {
  success: boolean
  length?: string
  color?: string
  dyeLot?: string
  rollId?: string
} {
  const upper = fileName.toUpperCase()
  const lengthMatch = upper.match(/(\d{2,3})/)?.[1]
  const dyeLotMatch = upper.match(/(DL[-_]?\d{2,5})/)?.[1]?.replace("_", "-")
  const rollIdMatch = upper.match(/(R[-_]?\d{1,4})/)?.[1]?.replace("_", "-")

  const looksBroken = upper.includes("DAMAGED") || upper.includes("BROKEN") || upper.includes("NO_LABEL")
  if (looksBroken) return { success: false }

  return {
    success: true,
    length: lengthMatch,
    color: upper.includes("BROWN") ? "Brown" : upper.includes("GREEN") ? "Green" : undefined,
    dyeLot: dyeLotMatch,
    rollId: rollIdMatch,
  }
}

type RollosFormProps = {
  fieldType: FieldType
  onSubmitRecord: (record: RollosRecord) => Promise<void> | void
}

export function RollosForm({ fieldType, onSubmitRecord }: RollosFormProps) {
  const [values, setValues] = useState<RollosFormValues>(INITIAL_VALUES)
  const [error, setError] = useState("")
  const [extractionMessage, setExtractionMessage] = useState("")
  const [isReadingLabel, setIsReadingLabel] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateManualField<K extends "length" | "color" | "dyeLot" | "rollId">(
    key: K,
    value: RollosFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value, manualOverride: true }))
  }

  async function handleLabelPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingLabel(true)
    setError("")

    try {
      const labelPhoto = await readAsDataUrl(file)
      const extraction = simulateLabelExtraction(file.name)

      setValues((prev) => ({
        ...prev,
        labelPhoto,
        length: extraction.success && extraction.length ? extraction.length : prev.length,
        color: extraction.success && extraction.color ? extraction.color : prev.color,
        dyeLot: extraction.success && extraction.dyeLot ? extraction.dyeLot : prev.dyeLot,
        rollId: extraction.success && extraction.rollId ? extraction.rollId : prev.rollId,
        manualOverride: !extraction.success,
      }))

      setExtractionMessage(
        extraction.success
          ? "Label parsed (simulated). If something is wrong, edit manually."
          : "Label is not readable. Fill fields manually.",
      )
    } catch {
      setError("Failed to load label photo.")
    } finally {
      setIsReadingLabel(false)
    }
  }

  async function handleInstallationPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const installationPhoto = await readAsDataUrl(file)
      setValues((prev) => ({ ...prev, installationPhoto }))
    } catch {
      setError("Failed to load installation photo.")
    }
  }

  function clearLabelPhoto() {
    setValues((prev) => ({ ...prev, labelPhoto: null, manualOverride: true }))
    setExtractionMessage("No label photo. Enter values manually.")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.zone) return setError("Zone is required.")
    if (!values.length || Number(values.length) <= 0) return setError("Length is required.")
    if (!values.status) return setError("Status is required.")

    const record: RollosRecord = {
      fieldType,
      zone: values.zone as Zone,
      labelData: {
        length: Number(values.length),
        color: values.color.trim() || undefined,
        dyeLot: values.dyeLot.trim() || undefined,
        rollId: values.rollId.trim() || undefined,
      },
      manualOverride: values.manualOverride || !values.labelPhoto,
      status: values.status as RollStatusSelection,
      trafficLightStatus: mapStatusToTrafficLight(values.status as RollStatusSelection),
      comments: values.comments.trim() || undefined,
      labelPhoto: values.labelPhoto ?? undefined,
      installationPhoto: values.installationPhoto ?? undefined,
      certifiedRoll: values.certifiedRoll,
      timestamp: new Date().toISOString(),
    }

    setIsSubmitting(true)
    setError("")

    try {
      console.log(JSON.stringify(record, null, 2))
      await onSubmitRecord(record)
      setValues(INITIAL_VALUES)
      setExtractionMessage("")
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
        <span className="text-sm text-neutral-300">Label Photo (optional)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleLabelPhotoChange}
          className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
        />
      </label>

      {values.labelPhoto ? (
        <>
          <Image
            src={values.labelPhoto}
            alt="Label preview"
            width={960}
            height={540}
            unoptimized
            className="h-48 w-full rounded-xl border border-neutral-700 object-cover"
          />
          <button
            type="button"
            onClick={clearLabelPhoto}
            className="rounded-xl border border-neutral-600 px-3 py-2 text-sm font-semibold hover:bg-neutral-800"
          >
            Label no visible
          </button>
        </>
      ) : (
        <p className="text-sm text-neutral-400">If no label, fill at least roll length manually.</p>
      )}

      {extractionMessage ? <p className="text-sm text-amber-300">{extractionMessage}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Length (required)</span>
          <input
            type="number"
            min={1}
            value={values.length}
            onChange={(event) => updateManualField("length", event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Color (optional)</span>
          <input
            type="text"
            value={values.color}
            onChange={(event) => updateManualField("color", event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Dye Lot (optional)</span>
          <input
            type="text"
            value={values.dyeLot}
            onChange={(event) => updateManualField("dyeLot", event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Roll ID (optional)</span>
          <input
            type="text"
            value={values.rollId}
            onChange={(event) => updateManualField("rollId", event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Installation Evidence Photo (optional)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInstallationPhotoChange}
          className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
        />
      </label>

      {values.installationPhoto ? (
        <Image
          src={values.installationPhoto}
          alt="Installation preview"
          width={960}
          height={540}
          unoptimized
          className="h-48 w-full rounded-xl border border-neutral-700 object-cover"
        />
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm text-neutral-300">Status</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map((option) => {
            const active = values.status === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, status: option.value }))}
                className={`rounded-xl border px-3 py-3 text-left ${
                  active
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                    : "border-neutral-700 bg-neutral-900"
                }`}
              >
                <p className="font-semibold">{option.label}</p>
                <p className="text-xs text-neutral-400">{option.helper}</p>
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm text-neutral-300">Comments (optional)</span>
        <textarea
          rows={3}
          value={values.comments}
          onChange={(event) => setValues((prev) => ({ ...prev, comments: event.target.value }))}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
        />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={isReadingLabel || isSubmitting}
        className="w-full rounded-xl bg-purple-600 px-4 py-3 font-semibold hover:bg-purple-700 disabled:opacity-50"
      >
        Save Roll Evidence
      </button>
    </form>
  )
}
