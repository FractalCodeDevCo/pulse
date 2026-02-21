"use client"

import Image from "next/image"
import Link from "next/link"
import { ChangeEvent, useState } from "react"

import { processImageFile } from "../../lib/clientImage"
import { PULSE_ZONE_OPTIONS, PulseZone } from "../../types/pulseZones"

type RollVerificationPageClientProps = {
  projectId: string | null
  projectZoneId: string | null
  fieldType: string | null
  macroZone: string | null
  microZone: string | null
  zoneType: string | null
}

export default function RollVerificationPageClient({
  projectId,
  projectZoneId,
  fieldType,
  macroZone,
  microZone,
  zoneType,
}: RollVerificationPageClientProps) {
  const [zone, setZone] = useState<PulseZone | "">((microZone as PulseZone | null) ?? "")
  const [lengthFt, setLengthFt] = useState("")
  const [colorLetter, setColorLetter] = useState("")
  const [status, setStatus] = useState<"Verified" | "Mismatch" | "">("")
  const [notes, setNotes] = useState("")
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const backToZoneOrHub =
    projectId && projectZoneId
      ? `/pulse/zones/${encodeURIComponent(projectZoneId)}?project=${encodeURIComponent(projectId)}`
      : `/pulse?project=${encodeURIComponent(projectId ?? "")}`

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError("")
    setIsReadingPhoto(true)
    try {
      const dataUrl = await processImageFile(file)
      setPhoto(dataUrl)
    } catch {
      setError("Could not load photo.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  async function submit() {
    if (!zone) return setError("Zone is required.")
    if (!status) return setError("Status is required.")
    if (!photo) return setError("Label photo is required.")

    setError("")
    setIsSubmitting(true)
    setSuccess("")

    try {
      const response = await fetch("/api/roll-verification", {
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
          length_ft: lengthFt ? Number(lengthFt) : null,
          color_letter: colorLetter.trim() || null,
          status,
          notes: notes.trim() || null,
          label_photo: photo,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? "Save failed")

      setSuccess("Roll verification saved.")
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
        <header className="space-y-2">
          <p className="text-sm text-neutral-400">Pulse / Roll Verification / {projectId}</p>
          <h1 className="text-3xl font-bold">Roll Verification</h1>
          {projectZoneId ? (
            <p className="text-sm text-neutral-400">
              Zona activa: {macroZone} / {microZone}
            </p>
          ) : null}
        </header>

        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Label Photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => void handlePhotoChange(event)}
              className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-sm"
            />
          </label>

          {photo ? (
            <Image
              src={photo}
              alt="Label Photo"
              width={1000}
              height={700}
              unoptimized
              className="h-56 w-full rounded-xl border border-neutral-700 object-cover"
            />
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Length (ft) - optional</span>
              <input
                type="number"
                min={0}
                value={lengthFt}
                onChange={(event) => setLengthFt(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Color Letter - optional</span>
              <input
                type="text"
                value={colorLetter}
                onChange={(event) => setColorLetter(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "Verified" | "Mismatch" | "")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            >
              <option value="">Select status</option>
              <option value="Verified">Verified</option>
              <option value="Mismatch">Mismatch</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Notes (optional)</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
            />
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSubmitting || isReadingPhoto}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Submit
          </button>

          {success ? (
            <Link
              href={backToZoneOrHub}
              className="block w-full rounded-xl border border-emerald-500 py-3 text-center font-semibold text-emerald-200 hover:bg-emerald-500/10"
            >
              Back
            </Link>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </section>
      </section>
    </main>
  )
}
