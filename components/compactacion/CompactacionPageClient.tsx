"use client"

import Link from "next/link"

import { CompactacionForm } from "./CompactacionForm"
import { FieldTypeSelector } from "../shared/FieldTypeSelector"
import { FieldType } from "../../types/fieldType"
import { CompactacionRecord } from "../../types/compactacion"

type CompactacionPageClientProps = {
  projectId: string | null
}

export default function CompactacionPageClient({ projectId }: CompactacionPageClientProps) {
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

  const fieldType: FieldType = "football"
  async function handleSubmitRecord(_record: CompactacionRecord) {
    return
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-neutral-400">Pulse / Capture / {projectId}</p>
          <h1 className="text-3xl font-bold">Compactación</h1>
        </header>

        <FieldTypeSelector value={fieldType} onChange={() => undefined} />
        <CompactacionForm fieldType={fieldType} projectId={projectId} onSubmitRecord={handleSubmitRecord} />
      </section>
    </main>
  )
}
