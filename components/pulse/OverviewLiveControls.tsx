"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type OverviewLiveControlsProps = {
  defaultIntervalSec?: number
}

export default function OverviewLiveControls({ defaultIntervalSec = 45 }: OverviewLiveControlsProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(true)
  const [intervalSec, setIntervalSec] = useState(defaultIntervalSec)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)

  const nextRefreshHint = useMemo(() => {
    if (!enabled) return "Auto refresh desactivado"
    return `Auto refresh cada ${intervalSec}s`
  }, [enabled, intervalSec])

  async function refreshNow() {
    setIsRefreshing(true)
    router.refresh()
    setLastRefreshAt(new Date().toISOString())
    window.setTimeout(() => setIsRefreshing(false), 500)
  }

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      void refreshNow()
    }, Math.max(15, intervalSec) * 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [enabled, intervalSec])

  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-800/60 bg-cyan-950/20 px-3 py-2">
      <p className="text-xs text-cyan-100">
        {nextRefreshHint}
        {lastRefreshAt ? ` · Última: ${new Date(lastRefreshAt).toLocaleTimeString("es-MX")}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-cyan-100">
          <span>Intervalo</span>
          <select
            value={intervalSec}
            onChange={(event) => setIntervalSec(Math.max(15, Number(event.target.value) || defaultIntervalSec))}
            className="rounded-lg border border-cyan-700/70 bg-neutral-950 px-2 py-1 text-xs text-cyan-100"
          >
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>60s</option>
            <option value={120}>120s</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setEnabled((current) => !current)}
          className="rounded-lg border border-cyan-700/70 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-700/20"
        >
          {enabled ? "Pausar auto" : "Activar auto"}
        </button>
        <button
          type="button"
          onClick={() => void refreshNow()}
          disabled={isRefreshing}
          className="rounded-lg border border-cyan-700/70 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-700/20 disabled:opacity-60"
        >
          {isRefreshing ? "Actualizando..." : "Actualizar ahora"}
        </button>
      </div>
    </section>
  )
}
