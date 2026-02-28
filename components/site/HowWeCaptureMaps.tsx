"use client"

import { useMemo, useState } from "react"

type Sport = "beisbol" | "soccer" | "football"

type ZoneInfo = {
  id: string
  title: string
  detail: string
}

const SPORT_LABELS: Record<Sport, string> = {
  beisbol: "Baseball",
  soccer: "Soccer",
  football: "Football",
}

const SPORT_ZONES: Record<Sport, ZoneInfo[]> = {
  beisbol: [
    { id: "infield", title: "Infield", detail: "Highest foot traffic and cut density. Critical for seam stability and adhesive consistency." },
    { id: "outfield", title: "Outfield", detail: "Large continuous area. Key for spread-rate consistency and long-run seam control." },
    { id: "warning-track", title: "Warning Track", detail: "Transition band with high correction probability. Monitor material continuity." },
  ],
  soccer: [
    { id: "center", title: "Center Corridor", detail: "High interaction strip. Prioritize alignment consistency and seam compression checks." },
    { id: "wings", title: "Wings", detail: "Long lateral runs. Track roll pairing and seam drift across side bands." },
    { id: "boxes", title: "Penalty Boxes", detail: "Frequent high-load area. Watch local deformation and correction frequency." },
  ],
  football: [
    { id: "midfield", title: "Midfield Core", detail: "Reference zone for installation consistency and baseline behavior." },
    { id: "endzones", title: "Endzones", detail: "High cut/detail complexity. Increased risk of deviation and rework time." },
    { id: "sidelines", title: "Sidelines", detail: "Operational wear boundary. Good indicator for seam opening over usage." },
  ],
}

export default function HowWeCaptureMaps() {
  const [sport, setSport] = useState<Sport>("beisbol")
  const [activeZoneId, setActiveZoneId] = useState<string>("")
  const zones = useMemo(() => SPORT_ZONES[sport], [sport])
  const activeZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0]

  return (
    <section className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(SPORT_LABELS) as Sport[]).map((item) => {
          const active = sport === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setSport(item)
                setActiveZoneId("")
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                active
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                  : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/60"
              }`}
            >
              {SPORT_LABELS[item]}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-800 bg-[#060d17] p-4">
          <svg viewBox="0 0 900 520" className="h-auto w-full">
            {sport === "beisbol" ? (
              <>
                <rect x="60" y="42" width="780" height="430" rx="18" fill="none" stroke="#dbeeff" strokeWidth="1.5" />
                <path d="M450 132 L620 302 L450 472 L280 302 Z" fill="none" stroke="#dbeeff" strokeWidth="1.5" />
                <circle
                  cx="450"
                  cy="302"
                  r="52"
                  fill={activeZone?.id === "infield" ? "rgba(72,188,255,0.4)" : "rgba(72,188,255,0.15)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("infield")}
                />
                <path
                  d="M260 360 Q450 156 640 360 L640 430 Q450 462 260 430 Z"
                  fill={activeZone?.id === "outfield" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.12)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("outfield")}
                />
                <path
                  d="M220 382 Q450 126 680 382 L680 436 Q450 486 220 436 Z"
                  fill={activeZone?.id === "warning-track" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("warning-track")}
                />
              </>
            ) : null}

            {sport === "soccer" ? (
              <>
                <rect x="70" y="60" width="760" height="400" rx="8" fill="none" stroke="#dbeeff" strokeWidth="1.5" />
                <line x1="450" y1="60" x2="450" y2="460" stroke="#dbeeff" strokeWidth="1.5" />
                <rect
                  x="350"
                  y="60"
                  width="200"
                  height="400"
                  fill={activeZone?.id === "center" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("center")}
                />
                <rect
                  x="70"
                  y="60"
                  width="280"
                  height="400"
                  fill={activeZone?.id === "wings" ? "rgba(72,188,255,0.32)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("wings")}
                />
                <rect
                  x="550"
                  y="60"
                  width="280"
                  height="400"
                  fill={activeZone?.id === "wings" ? "rgba(72,188,255,0.32)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("wings")}
                />
                <rect
                  x="70"
                  y="170"
                  width="100"
                  height="180"
                  fill={activeZone?.id === "boxes" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("boxes")}
                />
                <rect
                  x="730"
                  y="170"
                  width="100"
                  height="180"
                  fill={activeZone?.id === "boxes" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("boxes")}
                />
              </>
            ) : null}

            {sport === "football" ? (
              <>
                <rect x="70" y="60" width="760" height="400" rx="8" fill="none" stroke="#dbeeff" strokeWidth="1.5" />
                <rect
                  x="260"
                  y="60"
                  width="380"
                  height="400"
                  fill={activeZone?.id === "midfield" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("midfield")}
                />
                <rect
                  x="70"
                  y="60"
                  width="130"
                  height="400"
                  fill={activeZone?.id === "endzones" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("endzones")}
                />
                <rect
                  x="700"
                  y="60"
                  width="130"
                  height="400"
                  fill={activeZone?.id === "endzones" ? "rgba(72,188,255,0.35)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("endzones")}
                />
                <rect
                  x="200"
                  y="60"
                  width="60"
                  height="400"
                  fill={activeZone?.id === "sidelines" ? "rgba(72,188,255,0.3)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("sidelines")}
                />
                <rect
                  x="640"
                  y="60"
                  width="60"
                  height="400"
                  fill={activeZone?.id === "sidelines" ? "rgba(72,188,255,0.3)" : "rgba(72,188,255,0.1)"}
                  stroke="#dbeeff"
                  onMouseEnter={() => setActiveZoneId("sidelines")}
                />
              </>
            ) : null}
          </svg>
        </div>

        <aside className="space-y-3">
          {zones.map((zone) => {
            const active = activeZone?.id === zone.id
            return (
              <button
                key={zone.id}
                type="button"
                onMouseEnter={() => setActiveZoneId(zone.id)}
                onFocus={() => setActiveZoneId(zone.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  active
                    ? "border-cyan-400 bg-cyan-500/15"
                    : "border-slate-800 bg-slate-950/60 hover:border-cyan-500/60"
                }`}
              >
                <p className={`font-heading text-lg ${active ? "text-cyan-100" : "text-slate-100"}`}>{zone.title}</p>
                <p className={`mt-1 text-xs ${active ? "text-cyan-50" : "text-slate-400"}`}>{zone.detail}</p>
              </button>
            )
          })}
        </aside>
      </div>
    </section>
  )
}
