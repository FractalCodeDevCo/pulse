"use client"

import { useEffect, useMemo, useState } from "react"

type Sport = "baseball" | "soccer" | "football"

type ZoneConfig = {
  id: string
  label: string
  detail: string
}

const SPORT_ORDER: Sport[] = ["baseball", "soccer", "football"]

const SPORT_TITLES: Record<Sport, string> = {
  baseball: "Baseball",
  soccer: "Soccer",
  football: "Football",
}

const SPORT_SUBTITLES: Record<Sport, string> = {
  baseball: "Diamond operations mapped as repeatable execution zones.",
  soccer: "Pitch structure normalized into tactical control blocks.",
  football: "Gridiron segmentation translated into process intelligence.",
}

const SPORT_ZONES: Record<Sport, ZoneConfig[]> = {
  baseball: [
    { id: "infield", label: "Infield", detail: "Core execution ring around the diamond." },
    { id: "outfield", label: "Outfield", detail: "Extended coverage area for progression tracking." },
    { id: "warning-track", label: "Warning Track", detail: "Boundary band for edge-condition control." },
    { id: "foul-territory", label: "Foul Territory", detail: "Lateral variance zone for correction patterns." },
  ],
  soccer: [
    { id: "left-half", label: "Left Half", detail: "Primary corridor for phased movement capture." },
    { id: "right-half", label: "Right Half", detail: "Mirrored corridor for side-by-side comparison." },
    { id: "final-third", label: "Final Third", detail: "High-pressure zone for performance intensity." },
    { id: "penalty-areas", label: "Penalty Areas", detail: "Critical control pockets near each goal." },
  ],
  football: [
    { id: "midfield-core", label: "Midfield Core", detail: "Central stability zone for baseline cadence." },
    { id: "red-zone-left", label: "Left Red Zone", detail: "Terminal execution area near left end zone." },
    { id: "red-zone-right", label: "Right Red Zone", detail: "Terminal execution area near right end zone." },
    { id: "sideline-bands", label: "Sideline Bands", detail: "Boundary lanes for drift and consistency checks." },
  ],
}

export default function BlueprintSection() {
  const [phase, setPhase] = useState(0)
  const [sportIndex, setSportIndex] = useState(0)
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  const sport = SPORT_ORDER[sportIndex] ?? "baseball"

  useEffect(() => {
    const phaseTimer = window.setInterval(() => {
      setPhase((prev) => (prev + 1) % 6)
    }, 1300)

    return () => window.clearInterval(phaseTimer)
  }, [])

  useEffect(() => {
    const sportTimer = window.setInterval(() => {
      setSportIndex((prev) => (prev + 1) % SPORT_ORDER.length)
      setHoveredZone(null)
    }, 6200)

    return () => window.clearInterval(sportTimer)
  }, [])

  const message = useMemo(() => {
    const messages = ["Zone-based capture.", "Process normalization.", "Margin protected."]
    return messages[Math.max(0, phase - 3)] ?? "Blueprint activation sequence."
  }, [phase])

  const zoneOpacity = phase >= 1 ? 0.2 : 0
  const overlayOpacity = phase >= 2 ? 0.32 : 0
  const networkOpacity = phase >= 3 ? 0.82 : 0
  const messageOpacity = phase >= 4 ? 1 : 0

  return (
    <section className="relative mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 md:p-7">
      <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">Blueprint Activation</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        A living blueprint that transitions across sports while preserving one intelligence model: structured zones, connected evidence, and operational clarity.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060d17] p-3 md:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(32,90,150,0.22),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(32,90,150,0.18),transparent_40%)] blueprint-breathe" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_23px,rgba(110,150,190,0.14)_24px),linear-gradient(90deg,transparent_23px,rgba(110,150,190,0.1)_24px)] bg-[length:24px_24px] opacity-30" />

          <div className="relative">
            <BlueprintScene
              key={sport}
              sport={sport}
              zoneOpacity={zoneOpacity}
              overlayOpacity={overlayOpacity}
              networkOpacity={networkOpacity}
              message={message}
              messageOpacity={messageOpacity}
              hoveredZone={hoveredZone}
            />
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Active Sport</p>
            <p className="mt-1 font-heading text-xl text-slate-100">{SPORT_TITLES[sport]}</p>
            <p className="mt-1 text-xs text-slate-400">{SPORT_SUBTITLES[sport]}</p>
          </div>

          {SPORT_ZONES[sport].map((zone) => {
            const isActive = hoveredZone === zone.id
            return (
              <button
                key={zone.id}
                type="button"
                className={`w-full rounded-xl border p-3 text-left transition ${
                  isActive
                    ? "border-cyan-300 bg-cyan-500/20 shadow-[0_0_30px_rgba(58,161,255,0.15)]"
                    : "border-slate-800 bg-slate-900/60 hover:border-cyan-500/60 hover:bg-cyan-500/10"
                }`}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onFocus={() => setHoveredZone(zone.id)}
                onBlur={() => setHoveredZone(null)}
              >
                <p className={`text-xs uppercase tracking-[0.14em] ${isActive ? "text-cyan-200" : "text-slate-500"}`}>Zone</p>
                <p className={`mt-1 font-heading text-lg ${isActive ? "text-slate-50" : "text-slate-100"}`}>{zone.label}</p>
                <p className={`mt-1 text-xs ${isActive ? "text-cyan-100" : "text-slate-400"}`}>{zone.detail}</p>
              </button>
            )
          })}
        </aside>
      </div>

      <style jsx>{`
        .blueprint-breathe {
          animation: breathe 7s ease-in-out infinite;
        }
        @keyframes breathe {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.55;
          }
          50% {
            transform: scale(1.04);
            opacity: 0.85;
          }
        }
      `}</style>
    </section>
  )
}

function BlueprintScene({
  sport,
  zoneOpacity,
  overlayOpacity,
  networkOpacity,
  message,
  messageOpacity,
  hoveredZone,
}: {
  sport: Sport
  zoneOpacity: number
  overlayOpacity: number
  networkOpacity: number
  message: string
  messageOpacity: number
  hoveredZone: string | null
}) {
  const zoneStyle = (zoneId: string) => {
    if (!hoveredZone) {
      return { opacity: zoneOpacity, strokeOpacity: 0.45, strokeWidth: 1 }
    }

    if (hoveredZone === zoneId) {
      return { opacity: 0.5, strokeOpacity: 0.95, strokeWidth: 1.8 }
    }

    return { opacity: 0.07, strokeOpacity: 0.12, strokeWidth: 1 }
  }

  return (
    <div className="relative sport-fade">
      <svg viewBox="0 0 900 520" className="h-auto w-full">
        <g opacity={0.75} stroke="#e5f2ff" fill="none">
          <g strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {sport === "baseball" ? (
              <>
                <rect x="60" y="42" width="780" height="430" rx="18" className="outline-draw" />
                <path d="M450 132 L620 302 L450 472 L280 302 Z" className="outline-draw" />
                <circle cx="450" cy="302" r="52" className="outline-draw" />
                <path d="M240 356 Q450 134 660 356" className="outline-draw" />
              </>
            ) : null}

            {sport === "soccer" ? (
              <>
                <rect x="70" y="60" width="760" height="400" rx="8" className="outline-draw" />
                <line x1="450" y1="60" x2="450" y2="460" className="outline-draw" />
                <circle cx="450" cy="260" r="52" className="outline-draw" />
                <rect x="70" y="170" width="100" height="180" className="outline-draw" />
                <rect x="730" y="170" width="100" height="180" className="outline-draw" />
              </>
            ) : null}

            {sport === "football" ? (
              <>
                <rect x="70" y="60" width="760" height="400" rx="8" className="outline-draw" />
                <line x1="160" y1="60" x2="160" y2="460" className="outline-draw" />
                <line x1="250" y1="60" x2="250" y2="460" className="outline-draw" />
                <line x1="340" y1="60" x2="340" y2="460" className="outline-draw" />
                <line x1="450" y1="60" x2="450" y2="460" className="outline-draw" />
                <line x1="560" y1="60" x2="560" y2="460" className="outline-draw" />
                <line x1="650" y1="60" x2="650" y2="460" className="outline-draw" />
                <line x1="740" y1="60" x2="740" y2="460" className="outline-draw" />
              </>
            ) : null}
          </g>
        </g>

        <g fill="#49b6ff" stroke="#d7efff" transition="all 250ms ease">
          {sport === "baseball" ? (
            <>
              <circle cx="450" cy="302" r="52" {...zoneStyle("infield")} />
              <path d="M260 360 Q450 156 640 360 L640 430 Q450 462 260 430 Z" {...zoneStyle("outfield")} />
              <path d="M220 382 Q450 126 680 382 L680 436 Q450 486 220 436 Z" {...zoneStyle("warning-track")} />
              <rect x="80" y="82" width="180" height="360" rx="10" {...zoneStyle("foul-territory")} />
            </>
          ) : null}

          {sport === "soccer" ? (
            <>
              <rect x="70" y="60" width="380" height="400" {...zoneStyle("left-half")} />
              <rect x="450" y="60" width="380" height="400" {...zoneStyle("right-half")} />
              <rect x="70" y="60" width="760" height="132" {...zoneStyle("final-third")} />
              <g {...zoneStyle("penalty-areas")}>
                <rect x="70" y="170" width="100" height="180" />
                <rect x="730" y="170" width="100" height="180" />
              </g>
            </>
          ) : null}

          {sport === "football" ? (
            <>
              <rect x="260" y="60" width="380" height="400" {...zoneStyle("midfield-core")} />
              <rect x="70" y="60" width="130" height="400" {...zoneStyle("red-zone-left")} />
              <rect x="700" y="60" width="130" height="400" {...zoneStyle("red-zone-right")} />
              <g {...zoneStyle("sideline-bands")}>
                <rect x="200" y="60" width="60" height="400" />
                <rect x="640" y="60" width="60" height="400" />
              </g>
            </>
          ) : null}
        </g>

        <g stroke="#90ccff" strokeWidth="1" opacity={overlayOpacity} fill="none">
          <circle cx="450" cy="260" r="230" />
          <circle cx="450" cy="260" r="180" />
          <circle cx="450" cy="260" r="125" />
          <line x1="120" y1="260" x2="780" y2="260" />
          <line x1="450" y1="60" x2="450" y2="460" />
          <line x1="220" y1="110" x2="680" y2="410" />
          <line x1="680" y1="110" x2="220" y2="410" />
        </g>

        <g stroke="#c5e7ff" strokeWidth="1.2" opacity={networkOpacity}>
          <line x1="450" y1="260" x2="220" y2="140" />
          <line x1="450" y1="260" x2="680" y2="140" />
          <line x1="450" y1="260" x2="220" y2="380" />
          <line x1="450" y1="260" x2="680" y2="380" />
          <circle cx="450" cy="260" r="12" fill="#d9f0ff" />
          <circle cx="220" cy="140" r="4" fill="#d9f0ff" />
          <circle cx="680" cy="140" r="4" fill="#d9f0ff" />
          <circle cx="220" cy="380" r="4" fill="#d9f0ff" />
          <circle cx="680" cy="380" r="4" fill="#d9f0ff" />
        </g>
      </svg>

      <div className="absolute right-4 top-4 max-w-xs rounded-lg border border-cyan-500/60 bg-slate-950/90 p-3 text-xs text-slate-200" style={{ opacity: messageOpacity, transition: "opacity 350ms ease" }}>
        {message}
      </div>

      <style jsx>{`
        .sport-fade {
          animation: sportFade 600ms ease;
        }
        .outline-draw {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: drawLine 1.2s ease forwards;
        }
        @keyframes drawLine {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes sportFade {
          0% {
            opacity: 0.45;
            transform: scale(0.988);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
