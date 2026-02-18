"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { RollosForm } from "../../../components/rollos/RollosForm"
import { FieldTypeSelector } from "../../../components/shared/FieldTypeSelector"
import { saveCloudRecord } from "../../../lib/recordClient"
import { FieldType, readProjectFieldType, saveProjectFieldType } from "../../../types/fieldType"
import { RollosRecord } from "../../../types/rollos"
import { Zone } from "../../../types/zones"

function parseZone(zoneValue: string | null): Zone | "" {
  if (!zoneValue) return ""
  const upper = zoneValue.toUpperCase()
  if (upper in Zone) return Zone[upper as keyof typeof Zone]
  return ""
}

export default function RollosPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
          Cargando Instalación Rollos...
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

  const [records, setRecords] = useState<RollosRecord[]>([])
  const [fieldType, setFieldType] = useState<FieldType>(() =>
    projectId ? readProjectFieldType(projectId) : "football",
  )
  const [saveMessage, setSaveMessage] = useState("")

  function handleFieldTypeChange(next: FieldType) {
    if (!projectId) return
    setFieldType(next)
    saveProjectFieldType(projectId, next)
  }

  async function handleSubmitRecord(record: RollosRecord, returnToHub: boolean) {
    if (!projectId) return

    try {
      const response = await saveCloudRecord({
        module: "rollos",
        projectId,
        fieldType,
        payload: record as unknown as Record<string, unknown>,
      })
      console.log("[rollos] save_success", { id: response.id, projectId, module: "rollos" })
      setRecords((prev) => [record, ...prev])
      setSaveMessage("Guardado en nube.")
    } catch (error) {
      console.error("[rollos] save_failed", {
        projectId,
        module: "rollos",
        error: error instanceof Error ? error.message : "unknown_error",
      })
      setSaveMessage("Error al guardar en nube. Revisa conexión y campos.")
      throw error
    }

    if (returnToHub) {
      window.location.href = `/capture?project=${encodeURIComponent(projectId)}`
    }
  }

  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
        <p className="text-center text-neutral-300">Selecciona proyecto antes de capturar Instalación Rollos.</p>
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
          <h1 className="text-3xl font-bold">Instalación Rollos</h1>
          <p className="text-neutral-300">Fase unificada: Compactación + Rollos, por zona.</p>
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
