"use client"

import { useMemo, useState } from "react"

type DataSciencePanelProps = {
  projectId: string
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDateInput(date)
}

export default function DataSciencePanel({ projectId }: DataSciencePanelProps) {
  const [fromDate, setFromDate] = useState<string>(daysAgo(30))
  const [toDate, setToDate] = useState<string>(formatDateInput(new Date()))
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const captureCsvUrl = useMemo(() => {
    const query = new URLSearchParams({
      project: projectId,
      from: fromDate,
      to: toDate,
    })
    return `/api/exports/project-csv?${query.toString()}`
  }, [fromDate, projectId, toDate])

  const snapshotCsvUrl = useMemo(() => {
    const query = new URLSearchParams({
      project: projectId,
      from: fromDate,
      to: toDate,
      format: "csv",
    })
    return `/api/snapshots/zone-daily?${query.toString()}`
  }, [fromDate, projectId, toDate])

  async function generateSnapshots() {
    setError("")
    setMessage("")
    setIsGenerating(true)

    try {
      const response = await fetch("/api/snapshots/zone-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fromDate,
          toDate,
        }),
      })
      const data = (await response.json()) as {
        error?: string
        snapshotRows?: number
        zones?: number
      }

      if (!response.ok) throw new Error(data.error ?? "No se pudo generar snapshot.")
      setMessage(
        `Snapshot diario generado. Filas: ${data.snapshotRows ?? 0} · Zonas: ${data.zones ?? 0}`,
      )
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "No se pudo generar snapshot.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-xl font-semibold">Data Science Export</h2>
      <p className="text-sm text-neutral-400">
        Exporta CSV estable y genera snapshots diarios acumulados por zona.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-neutral-300">Desde</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-neutral-300">Hasta</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <a
          href={captureCsvUrl}
          className="rounded-xl border border-cyan-500 px-3 py-3 text-center text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
        >
          Descargar CSV Capturas
        </a>
        <button
          type="button"
          onClick={() => void generateSnapshots()}
          disabled={isGenerating}
          className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? "Generando..." : "Generar Snapshot Diario"}
        </button>
        <a
          href={snapshotCsvUrl}
          className="rounded-xl border border-amber-500 px-3 py-3 text-center text-sm font-semibold text-amber-300 hover:bg-amber-500/10"
        >
          Descargar Snapshot CSV
        </a>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  )
}
