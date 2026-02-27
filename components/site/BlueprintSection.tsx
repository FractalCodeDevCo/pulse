"use client"

import { useEffect, useRef, useState } from "react"

type Sport = "baseball" | "soccer" | "football"

function sportFromProgress(progress: number): Sport {
  if (progress < 0.34) return "baseball"
  if (progress < 0.67) return "soccer"
  return "football"
}

export default function BlueprintSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [phase, setPhase] = useState(0)
  const [sport, setSport] = useState<Sport>("baseball")

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((prev) => (prev + 1) % 6)
    }, 1300)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function onScroll() {
      const element = sectionRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight
      const total = rect.height + viewport
      const consumed = viewport - rect.top
      const progress = Math.max(0, Math.min(1, consumed / total))
      setSport(sportFromProgress(progress))
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  const copy = ["Zone-based capture.", "Process normalization.", "Margin protected."][Math.max(0, phase - 3)] ?? "Blueprint activation sequence."
  const zoneOpacity = phase >= 2 ? 0.2 : 0
  const overlayOpacity = phase >= 3 ? 0.3 : 0
  const networkOpacity = phase >= 4 ? 0.8 : 0
  const messageOpacity = phase >= 3 ? 1 : 0

  return (
    <section ref={sectionRef} className="relative mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 md:p-7">
      <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">Blueprint Activation</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Structure, activation, and intelligence. Scroll to transition from baseball to soccer to football while the zone logic remains universal.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060d17] p-3 md:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(32,90,150,0.22),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(32,90,150,0.18),transparent_40%)] blueprint-breathe" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_23px,rgba(110,150,190,0.14)_24px),linear-gradient(90deg,transparent_23px,rgba(110,150,190,0.1)_24px)] bg-[length:24px_24px] opacity-30" />

          <div className="relative">
            <BlueprintScene
              sport={sport}
              zoneOpacity={zoneOpacity}
              overlayOpacity={overlayOpacity}
              networkOpacity={networkOpacity}
              message={copy}
              messageOpacity={messageOpacity}
            />
          </div>
        </div>

        <div className="space-y-3">
          <StageItem active={phase === 0} title="1" text="Technical field outline is drawn." />
          <StageItem active={phase === 1} title="2" text="Execution zones illuminate progressively." />
          <StageItem active={phase === 2} title="3" text="Geometry overlay activates." />
          <StageItem active={phase === 3} title="4" text="Connection network converges to center." />
          <StageItem active={phase >= 4} title="5" text="System message locks: operational intelligence." />
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            Active map: {sport === "baseball" ? "Baseball" : sport === "soccer" ? "Soccer" : "Football"}
          </div>
        </div>
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

function StageItem({ active, title, text }: { active: boolean; title: string; text: string }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-900/50"}`}>
      <p className={`text-xs uppercase tracking-[0.14em] ${active ? "text-cyan-200" : "text-slate-500"}`}>{title}</p>
      <p className={`mt-1 text-sm ${active ? "text-slate-100" : "text-slate-400"}`}>{text}</p>
    </div>
  )
}

function BlueprintScene({
  sport,
  zoneOpacity,
  overlayOpacity,
  networkOpacity,
  message,
  messageOpacity,
}: {
  sport: Sport
  zoneOpacity: number
  overlayOpacity: number
  networkOpacity: number
  message: string
  messageOpacity: number
}) {
  return (
    <div className="relative">
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

        <g fill="#49b6ff" opacity={zoneOpacity}>
          {sport === "baseball" ? (
            <>
              <circle cx="450" cy="302" r="52" />
              <rect x="280" y="262" width="340" height="82" rx="6" />
              <rect x="80" y="82" width="180" height="360" rx="10" />
              <rect x="640" y="82" width="180" height="360" rx="10" />
            </>
          ) : null}
          {sport === "soccer" ? (
            <>
              <rect x="70" y="60" width="380" height="400" />
              <rect x="450" y="60" width="380" height="400" />
              <rect x="70" y="170" width="100" height="180" />
              <rect x="730" y="170" width="100" height="180" />
            </>
          ) : null}
          {sport === "football" ? (
            <>
              <rect x="70" y="60" width="90" height="400" />
              <rect x="740" y="60" width="90" height="400" />
              <rect x="250" y="60" width="400" height="400" />
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
      `}</style>
    </div>
  )
}
