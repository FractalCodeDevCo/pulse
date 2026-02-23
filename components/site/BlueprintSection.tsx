"use client"

import { useEffect, useRef, useState } from "react"

type Stage = 1 | 2 | 3 | 4 | 5 | 6

function stageFromProgress(progress: number): Stage {
  if (progress < 0.17) return 1
  if (progress < 0.34) return 2
  if (progress < 0.51) return 3
  if (progress < 0.68) return 4
  if (progress < 0.85) return 5
  return 6
}

export default function BlueprintSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [stage, setStage] = useState<Stage>(1)

  useEffect(() => {
    function onScroll() {
      const element = sectionRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight
      const total = rect.height + viewport
      const consumed = viewport - rect.top
      const progress = Math.max(0, Math.min(1, consumed / total))
      setStage(stageFromProgress(progress))
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <section ref={sectionRef} className="relative mt-10 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 md:p-7">
      <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">Interactive Blueprint</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Conceptual zone logic, process normalization, and structured workflow applied across sports installations.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-slate-800 bg-[#071320] p-3 md:p-5">
          {stage <= 3 ? <BaseballBlueprint stage={stage} /> : null}
          {stage >= 4 && stage <= 5 ? <SoccerBlueprint stage={stage} /> : null}
          {stage >= 6 ? <FootballBlueprint /> : null}
        </div>

        <div className="space-y-3">
          <StageItem active={stage === 1} title="Stage 1" text="Field blueprint appears." />
          <StageItem active={stage === 2 || stage === 4 || stage === 6} title="Stage 2" text="Zones highlight progressively." />
          <StageItem active={stage === 3 || stage === 5} title="Stage 3" text="Structured capture philosophy appears." />

          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            {stage <= 3 ? "Baseball blueprint" : stage <= 5 ? "Soccer blueprint" : "Football blueprint (optional layer)"}
          </div>
        </div>
      </div>
    </section>
  )
}

function StageItem({ active, title, text }: { active: boolean; title: string; text: string }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-900/50"}`}>
      <p className={`text-xs uppercase tracking-[0.14em] ${active ? "text-cyan-200" : "text-slate-500"}`}>{title}</p>
      <p className={`mt-1 text-sm ${active ? "text-slate-100" : "text-slate-400"}`}>{text}</p>
    </div>
  )
}

function BaseballBlueprint({ stage }: { stage: Stage }) {
  const showZones = stage >= 2
  const showTooltip = stage >= 3

  return (
    <div className="relative">
      <svg viewBox="0 0 900 520" className="h-auto w-full">
        <g stroke="#2f546f" fill="none" strokeWidth="2">
          <rect x="60" y="40" width="780" height="420" rx="16" />
          <path d="M450 140 L620 310 L450 480 L280 310 Z" />
          <circle cx="450" cy="310" r="52" />
          <path d="M240 360 Q450 140 660 360" />
        </g>
        <g fill="#39a0d4" opacity={showZones ? 0.18 : 0}>
          <circle cx="450" cy="310" r="52" />
          <rect x="280" y="270" width="340" height="80" rx="6" />
          <rect x="80" y="80" width="180" height="360" rx="10" />
          <rect x="640" y="80" width="180" height="360" rx="10" />
        </g>
      </svg>

      {showTooltip ? (
        <div className="absolute right-4 top-4 max-w-xs rounded-lg border border-cyan-500/60 bg-slate-950/95 p-3 text-xs text-slate-200">
          Zone-based capture. Process normalization. Structured workflow.
        </div>
      ) : null}
    </div>
  )
}

function SoccerBlueprint({ stage }: { stage: Stage }) {
  const showZones = stage >= 4
  const showTooltip = stage >= 5

  return (
    <div className="relative">
      <svg viewBox="0 0 900 520" className="h-auto w-full">
        <g stroke="#2f546f" fill="none" strokeWidth="2">
          <rect x="70" y="60" width="760" height="400" rx="8" />
          <line x1="450" y1="60" x2="450" y2="460" />
          <circle cx="450" cy="260" r="52" />
          <rect x="70" y="170" width="100" height="180" />
          <rect x="730" y="170" width="100" height="180" />
          <rect x="70" y="215" width="42" height="90" />
          <rect x="788" y="215" width="42" height="90" />
        </g>
        <g fill="#39a0d4" opacity={showZones ? 0.18 : 0}>
          <rect x="70" y="60" width="380" height="400" />
          <rect x="450" y="60" width="380" height="400" />
          <rect x="70" y="170" width="100" height="180" />
          <rect x="730" y="170" width="100" height="180" />
        </g>
      </svg>

      {showTooltip ? (
        <div className="absolute right-4 top-4 max-w-xs rounded-lg border border-cyan-500/60 bg-slate-950/95 p-3 text-xs text-slate-200">
          Same zone logic across field types enables standardized execution.
        </div>
      ) : null}
    </div>
  )
}

function FootballBlueprint() {
  return (
    <div className="relative">
      <svg viewBox="0 0 900 520" className="h-auto w-full">
        <g stroke="#2f546f" fill="none" strokeWidth="2">
          <rect x="70" y="60" width="760" height="400" rx="8" />
          <line x1="160" y1="60" x2="160" y2="460" />
          <line x1="740" y1="60" x2="740" y2="460" />
          <line x1="450" y1="60" x2="450" y2="460" />
          <line x1="250" y1="60" x2="250" y2="460" />
          <line x1="340" y1="60" x2="340" y2="460" />
          <line x1="560" y1="60" x2="560" y2="460" />
          <line x1="650" y1="60" x2="650" y2="460" />
        </g>
        <g fill="#39a0d4" opacity={0.2}>
          <rect x="70" y="60" width="90" height="400" />
          <rect x="740" y="60" width="90" height="400" />
          <rect x="250" y="60" width="400" height="400" />
        </g>
      </svg>
      <div className="absolute right-4 top-4 max-w-xs rounded-lg border border-cyan-500/60 bg-slate-950/95 p-3 text-xs text-slate-200">
        Universal blueprint principle: any sport can be structured as intelligent zones.
      </div>
    </div>
  )
}
