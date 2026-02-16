"use client"

import Link from "next/link"

type CaptureHubClientProps = {
  projectId: string | null
}

export default function CaptureHubClient({ projectId }: CaptureHubClientProps) {
  if (!projectId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-4 text-white">
        <h1 className="text-2xl font-bold">Falta seleccionar proyecto</h1>
        <p className="text-center text-neutral-400">
          Primero elige un proyecto para abrir los módulos de captura.
        </p>
        <Link
          href="/projects?flow=load"
          className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700"
        >
          Ir a proyectos
        </Link>
      </main>
    )
  }

  const q = `?project=${encodeURIComponent(projectId)}`

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-950 px-4 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Módulos de captura</h1>
        <p className="mt-1 text-sm text-neutral-400">Proyecto: {projectId}</p>
      </div>

      <div className="flex w-80 flex-col gap-4">
        <Link
          href={`/capture/compactacion${q}`}
          className="rounded-xl bg-orange-600 py-4 text-center text-lg font-bold transition hover:bg-orange-700"
        >
          Compactacion
        </Link>

        <Link
          href={`/capture/material${q}`}
          className="rounded-xl bg-blue-600 py-4 text-center text-lg font-bold transition hover:bg-blue-700"
        >
          Material
        </Link>

        <Link
          href={`/capture/pegada${q}`}
          className="rounded-xl bg-green-600 py-4 text-center text-lg font-bold transition hover:bg-green-700"
        >
          Pegada
        </Link>

        <Link
          href={`/capture/rollos${q}`}
          className="rounded-xl bg-purple-600 py-4 text-center text-lg font-bold transition hover:bg-purple-700"
        >
          Rollos
        </Link>
      </div>

      <Link
        href="/projects?flow=load"
        className="rounded-xl border border-neutral-600 px-4 py-2 text-sm font-semibold hover:bg-neutral-800"
      >
        Cambiar proyecto
      </Link>
    </main>
  )
}
