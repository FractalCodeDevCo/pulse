"use client"

import Link from "next/link"
import { useEffect } from "react"

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[ui-error-boundary]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-white">
      <h1 className="text-2xl font-bold">Application error</h1>
      <p className="max-w-lg text-center text-neutral-300">
        Ocurrió un error en la captura. Puedes reintentar o volver al hub.
      </p>
      <div className="flex w-full max-w-md gap-3">
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="w-full rounded-xl border border-neutral-600 px-4 py-3 text-center font-semibold hover:bg-neutral-800"
        >
          Ir a inicio
        </Link>
      </div>
    </main>
  )
}
