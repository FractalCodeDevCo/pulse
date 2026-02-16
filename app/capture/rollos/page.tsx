"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { RollosForm } from "../../../components/rollos/RollosForm"
import { FieldTypeSelector } from "../../../components/shared/FieldTypeSelector"
import { createRollosRecord } from "../../../lib/zoneRecordsClient"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"
import { RollosRecord } from "../../../types/rollos"
import { Zone } from "../../../types/zones"

function parseZone(zoneValue: string | null): Zone | "" {
  if (!zoneValue) return ""
  const upper = zoneValue.toUpperCase()
  if (upper in Zone) return Zone[upper as keyof typeof Zone]
  return ""
}

function readRollosRecords(storageKey: string): RollosRecord[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    return JSON.parse(raw) as RollosRecord[]
  } catch {
    return []
  }
}

export default function RollosPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
          Cargando Rollos...
        </main>
      }
    >
      <RollosPageContent />
    </Suspense>
  )
}

function RollosPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  const defaultZone = parseZone(searchParams.get("zone"))
  const storageKey = `pulse_rollos_records_${projectId ?? "default"}`
  const queueKey = `pulse_rollos_queue_${projectId ?? "default"}`

  const [records, setRecords] = useState<RollosRecord[]>(() => readRollosRecords(storageKey))
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

    let queued: RollosRecord[] = []
    try {
      queued = JSON.parse(raw) as RollosRecord[]
    } catch {
      localStorage.removeItem(queueKey)
      return
    }

    if (queued.length === 0) {
      localStorage.removeItem(queueKey)
      return
    }

    const failed: RollosRecord[] = []

    for (const item of queued) {
      try {
        await createRollosRecord(item)
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

  async function handleSubmitRecord(record: RollosRecord) {
    setRecords((prev) => [record, ...prev])

    if (!projectId || typeof window === "undefined") return

    try {
      await createRollosRecord(record)
      setSaveMessage("Guardado en nube.")
    } catch {
      const raw = localStorage.getItem(queueKey)
      const queued = raw ? (JSON.parse(raw) as RollosRecord[]) : []
      localStorage.setItem(queueKey, JSON.stringify([record, ...queued]))
      setSaveMessage("Guardado local. Se sincroniza al recuperar conexión.")
    }
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar Rollos.</p>
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
          <h1 className="text-3xl font-bold">Rollos</h1>
          <p className="text-neutral-300">Registro por zona completada o parcial, no por rollo individual.</p>
        </header>

        <FieldTypeSelector value={fieldType} onChange={handleFieldTypeChange} />

        <RollosForm
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
