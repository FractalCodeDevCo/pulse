'use client';

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { CompactacionForm } from "../../../components/compactacion/CompactacionForm"
import { FieldTypeSelector } from "../../../components/shared/FieldTypeSelector"
import { createCompactacionRecord } from "../../../lib/zoneRecordsClient"
import { CompactacionRecord } from "../../../types/compactacion"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"
import { Zone } from "../../../types/zones"

function parseZone(zoneValue: string | null): Zone | "" {
  if (!zoneValue) return ""
  const upper = zoneValue.toUpperCase()
  if (upper in Zone) return Zone[upper as keyof typeof Zone]
  return ""
}

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
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
          Cargando Compactación...
        </main>
      }
    >
      <CompactacionPageContent />
    </Suspense>
  )
}

function CompactacionPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  const defaultZone = parseZone(searchParams.get("zone"))
  const storageKey = `pulse_compactacion_records_${projectId ?? "default"}`
  const queueKey = `pulse_compactacion_queue_${projectId ?? "default"}`

  const [records, setRecords] = useState<CompactacionRecord[]>(() => readCompactacionRecords(storageKey))
  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records))
  }, [records, storageKey])

  async function flushQueue() {
    if (!projectId || typeof window === "undefined") return

    const raw = localStorage.getItem(queueKey)
    if (!raw) return

    let queued: CompactacionRecord[] = []
    try {
      queued = JSON.parse(raw) as CompactacionRecord[]
    } catch {
      localStorage.removeItem(queueKey)
      return
    }

    if (queued.length === 0) {
      localStorage.removeItem(queueKey)
      return
    }

    const failed: CompactacionRecord[] = []

    for (const item of queued) {
      try {
        await createCompactacionRecord(item)
      } catch {
        failed.push(item)
      }
    }

    if (failed.length > 0) {
      localStorage.setItem(queueKey, JSON.stringify(failed))
    } else {
      localStorage.removeItem(queueKey)
      setSaveMessage("Sincronización completada.")
    }
  }

  useEffect(() => {
    void flushQueue()
    const onOnline = () => void flushQueue()

    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  function handleFieldTypeChange(next: FieldType) {
    if (!projectId) return
    setFieldType(next)
    saveProjectFieldType(projectId, next)
  }

  async function handleSubmitRecord(record: CompactacionRecord) {
    setRecords((prev) => [record, ...prev])

    if (!projectId || typeof window === "undefined") return

    try {
      await createCompactacionRecord(record)
      setSaveMessage("Guardado en nube.")
    } catch {
      const raw = localStorage.getItem(queueKey)
      const queued = raw ? (JSON.parse(raw) as CompactacionRecord[]) : []
      localStorage.setItem(queueKey, JSON.stringify([record, ...queued]))
      setSaveMessage("Guardado local. Se sincroniza al recuperar conexión.")
    }
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar Compactación.</p>
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
          <h1 className="text-3xl font-bold">Compactación</h1>
          <p className="text-neutral-300">General antes de zona y Ajuste antes de estirar rollos, por zona.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <CompactacionForm
          fieldType={fieldType}
          projectId={projectId}
          defaultZone={defaultZone}
          onSubmitRecord={handleSubmitRecord}
        />

        {saveMessage ? (
          <p className="rounded-xl border border-blue-500/70 bg-blue-500/10 p-3 text-sm text-blue-300">
            {saveMessage}
          </p>
        ) : null}

        {records.length > 0 ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Último registro</p>
            <pre className="mt-2 overflow-x-auto text-xs text-neutral-200">
              {JSON.stringify(records[0], null, 2)}
            </pre>
          </section>
        ) : null}
      </section>
    </main>
  )
}
