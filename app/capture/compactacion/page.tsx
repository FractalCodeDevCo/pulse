"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { CompactacionForm } from "../../../components/compactacion/CompactacionForm"
import { FieldTypeSelector } from "../../../components/shared/FieldTypeSelector"
import { saveCloudRecord } from "../../../lib/recordClient"
import { CompactacionRecord } from "../../../types/compactacion"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"

function readCompactacionRecords(storageKey: string): CompactacionRecord[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    return JSON.parse(raw) as CompactacionRecord[]
  } catch {
    return []
  }
}

export default function CompactacionPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  const storageKey = `pulse_compactacion_records_${projectId ?? "default"}`

  const [records, setRecords] = useState<CompactacionRecord[]>(() => readCompactacionRecords(storageKey))
  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records))
  }, [records, storageKey])

  function handleFieldTypeChange(next: FieldType) {
    if (!projectId) return
    setFieldType(next)
    saveProjectFieldType(projectId, next)
  }

  async function handleSubmitRecord(record: CompactacionRecord) {
    setRecords((prev) => [record, ...prev])

    if (!projectId) return

    try {
      await saveCloudRecord({
        module: "compactacion",
        projectId,
        fieldType,
        payload: record as unknown as Record<string, unknown>,
      })
      setSaveMessage("Guardado en nube.")
    } catch {
      setSaveMessage("Guardado local (sin conexión a nube).")
    }
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar Compactacion.</p>
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
          <p className="text-sm text-neutral-400">Pulse / Capture / {projectId}</p>
          <h1 className="text-3xl font-bold">Compactacion</h1>
          <p className="text-neutral-300">Base prep evidence before roll installation.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <CompactacionForm fieldType={fieldType} onSubmitRecord={handleSubmitRecord} />

        {saveMessage ? (
          <p className="rounded-xl border border-blue-500/70 bg-blue-500/10 p-3 text-sm text-blue-300">
            {saveMessage}
          </p>
        ) : null}

        {records.length > 0 ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Last capture</p>
            <pre className="mt-2 overflow-x-auto text-xs text-neutral-200">
              {JSON.stringify(records[0], null, 2)}
            </pre>
          </section>
        ) : null}
      </section>
    </main>
  )
}
