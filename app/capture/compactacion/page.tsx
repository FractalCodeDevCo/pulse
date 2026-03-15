"use client"

import Link from "next/link"
import { useState } from "react"

function getProjectIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("project")
}

export default function CompactacionPage() {
  const [projectId] = useState<string | null>(() => getProjectIdFromUrl())
  const q = projectId ? `?project=${encodeURIComponent(projectId)}` : ""

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-4 text-white">
      <h1 className="text-2xl font-bold">Fase unificada</h1>
      <p className="max-w-lg text-center text-neutral-300">
        Compactación y Rollos ahora se capturan juntos en un solo formulario para operación más rápida.
      </p>
      <Link
        href={`/capture/rollos${q}`}
        className="rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700"
      >
        Ir a Instalación Rollos
      </Link>
    </main>
  )
}
