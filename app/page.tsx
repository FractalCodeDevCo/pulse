'use client';

import Link from "next/link"
import { useState } from "react"

const LAST_PROJECT_STORAGE_KEY = "pulse_last_project"

function getInitialLoadHref(): string {
  if (typeof window === "undefined") return "/projects?flow=load"

  try {
    const raw = localStorage.getItem(LAST_PROJECT_STORAGE_KEY)
    if (!raw) return "/projects?flow=load"
    const projectId = JSON.parse(raw) as string
    if (!projectId) return "/projects?flow=load"
    return `/capture?project=${encodeURIComponent(projectId)}`
  } catch {
    return "/projects?flow=load"
  }
}

export default function Home() {
  const [loadProjectHref] = useState<string>(() => getInitialLoadHref())

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold">PULSE</h1>
        <p className="max-w-xl text-center text-neutral-400">
          Sistema de captura para producción de instalación deportiva.
        </p>

        <div className="grid w-full gap-3 sm:grid-cols-3">
          <Link
            href="/projects?flow=new"
            className="rounded-xl bg-emerald-600 px-4 py-4 text-center font-semibold hover:bg-emerald-700"
          >
            Nuevo proyecto
          </Link>

          <Link
            href={loadProjectHref}
            className="rounded-xl bg-blue-600 px-4 py-4 text-center font-semibold hover:bg-blue-700"
          >
            Cargar proyecto
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-neutral-600 px-4 py-4 text-center font-semibold hover:bg-neutral-900"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}
