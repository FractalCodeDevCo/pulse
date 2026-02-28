"use client"

import { useMemo, useState } from "react"

type ZoneKey = "outfield" | "warning_track" | "infield"

const ZONE_LABELS: Record<ZoneKey, string> = {
  outfield: "Outfield",
  warning_track: "Warning Track",
  infield: "Infield",
}

const ZONE_ROLLS: Record<ZoneKey, string[]> = {
  outfield: ["A", "B", "C", "D", "E", "F"],
  warning_track: ["WT-1", "WT-2", "WT-3", "WT-4"],
  infield: ["IF-1", "IF-2", "IF-3"],
}

const DETECTED_PAGES = [
  { name: "Plan Sheet 01", type: "Blueprint (clean)", confidence: 0.88 },
  { name: "Plan Sheet 02", type: "Blueprint (dimensions)", confidence: 0.83 },
  { name: "Plan Sheet 06", type: "Roll layout + color legend", confidence: 0.92 },
]

export default function PlanIntelligencePreviewSection() {
  const [activeZone, setActiveZone] = useState<ZoneKey>("outfield")
  const [selectedRolls, setSelectedRolls] = useState<string[]>([])

  const availableRolls = useMemo(() => ZONE_ROLLS[activeZone], [activeZone])
  const progress = useMemo(() => {
    if (availableRolls.length === 0) return 0
    return Math.round((selectedRolls.length / availableRolls.length) * 100)
  }, [availableRolls.length, selectedRolls.length])

  function toggleRoll(roll: string) {
    setSelectedRolls((prev) => (prev.includes(roll) ? prev.filter((item) => item !== roll) : [...prev, roll]))
  }

  function handleZoneChange(zone: ZoneKey) {
    setActiveZone(zone)
    setSelectedRolls([])
  }

  return (
    <section className="relative mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 md:p-7">
      <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">Plan Intelligence Preview</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Future mode demo: upload a plan PDF, detect the roll-layout sheet, map rolls by zone, then select rolls and launch capture with real context.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-slate-800 bg-[#060d17] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">1. Plan Analysis</p>
          <div className="mt-3 space-y-2">
            {DETECTED_PAGES.map((page) => (
              <div key={page.name} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-sm font-semibold text-slate-100">{page.name}</p>
                <p className="mt-1 text-xs text-slate-400">{page.type}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.round(page.confidence * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Generated Roll-Zone Map</p>
            <div className="mt-2 space-y-2 text-xs text-slate-300">
              <p>Outfield: A, B, C, D, E, F</p>
              <p>Warning Track: WT-1, WT-2, WT-3, WT-4</p>
              <p>Infield: IF-1, IF-2, IF-3</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-[#060d17] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">2. Interactive Capture</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(Object.keys(ZONE_LABELS) as ZoneKey[]).map((zone) => {
              const active = activeZone === zone
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => handleZoneChange(zone)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/60"
                  }`}
                >
                  {ZONE_LABELS[zone]}
                </button>
              )
            })}
          </div>

          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-400">Rolls for {ZONE_LABELS[activeZone]}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableRolls.map((roll) => {
              const active = selectedRolls.includes(roll)
              return (
                <button
                  key={roll}
                  type="button"
                  onClick={() => toggleRoll(roll)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    active
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/60"
                  }`}
                >
                  {roll}
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs text-slate-300">
              Selected: <span className="font-semibold text-slate-100">{selectedRolls.length}</span> / {availableRolls.length}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-cyan-200">Progress in zone: {progress}%</p>
          </div>

          <button
            type="button"
            disabled={selectedRolls.length === 0}
            className="mt-4 w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open Capture Questionnaire ({selectedRolls.length} selected)
          </button>
        </article>
      </div>
    </section>
  )
}
