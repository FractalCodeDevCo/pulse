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
  football: "Football",
  soccer: "Soccer",
}

const SPORT_ZONES: Record<Sport, ZoneInfo[]> = {
  beisbol: [
    {
      id: "infield",
      title: "Infield",
      detail: "Primary high-traffic playing wedge where seam tolerance and adhesive control are most sensitive.",
    },
    {
      id: "outfield",
      title: "Outfield",
      detail: "Main fair-territory body for long-run alignment, roll continuity, and production cadence.",
    },
    {
      id: "foul-territory",
      title: "Foul Territory",
      detail: "Side bands outside foul lines used to track trims, corrections, and edge efficiency.",
    },
    {
      id: "warning-track",
      title: "Warning Track",
      detail: "Perimeter arc strip near the fence where geometry transitions can trigger rework if unstable.",
    },
    {
      id: "bullpen",
      title: "Bullpen",
      detail: "Auxiliary practice lane with separate cut logic and roll traceability.",
    },
  ],
  football: [
    {
      id: "playing-field",
      title: "Playing Field",
      detail: "Primary 100-yard execution body used as baseline for production cadence and quality drift.",
    },
    {
      id: "end-zone-a",
      title: "End Zone A",
      detail: "Terminal zone with tighter graphic/detail risk and higher rework sensitivity.",
    },
    {
      id: "end-zone-b",
      title: "End Zone B",
      detail: "Second terminal zone tracked independently to detect crew-side execution asymmetry.",
    },
    {
      id: "sideline-a",
      title: "Sideline A",
      detail: "Upper boundary lane where long seams and edge handling expose consistency gaps.",
    },
    {
      id: "sideline-b",
      title: "Sideline B",
      detail: "Lower boundary lane monitored against Sideline A for directional variance.",
    },
    {
      id: "perimeter",
      title: "Perimeter Boundary",
      detail: "Outer control ring for offsets, dimensional checks, and final geometry protection.",
    },
  ],
  soccer: [
    {
      id: "gaa",
      title: "GAA",
      detail: "Left attacking block starting at the large penalty area geometry.",
    },
    {
      id: "pz",
      title: "PZ",
      detail: "Central playing zone used for main production rhythm and seam straightness checks.",
    },
    {
      id: "gao",
      title: "GAO",
      detail: "Right attacking block starting at the large penalty area geometry.",
    },
    {
      id: "perimeter-sideline",
      title: "Perimeter Sideline",
      detail: "Outer sideline boundary for dimensional lock, corner trimming, and line integrity.",
    },
  ],
}

const BASE_FILL = "rgba(73, 182, 255, 0.1)"
const ACTIVE_FILL = "rgba(73, 182, 255, 0.32)"
const STROKE = "#d9eeff"

function getZoneFill(activeZoneId: string, zoneId: string) {
  return activeZoneId === zoneId ? ACTIVE_FILL : BASE_FILL
}

export default function HowWeCaptureMaps() {
  const [sport, setSport] = useState<Sport>("beisbol")
  const [activeZoneId, setActiveZoneId] = useState<string>(SPORT_ZONES.beisbol[0].id)

  const zones = useMemo(() => SPORT_ZONES[sport], [sport])
  const activeZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0]

  function changeSport(nextSport: Sport) {
    setSport(nextSport)
    setActiveZoneId(SPORT_ZONES[nextSport][0].id)
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(SPORT_LABELS) as Sport[]).map((item) => {
          const active = sport === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => changeSport(item)}
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
        <div className="rounded-2xl border border-slate-800 bg-[#050b14] p-4">
          <svg viewBox="0 0 900 520" className="h-auto w-full">
            <defs>
              <pattern id="capture-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" fill="none" stroke="rgba(160,210,240,0.08)" strokeWidth="1" />
              </pattern>
              <pattern id="capture-micro-grid" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M6 0H0V6" fill="none" stroke="rgba(160,210,240,0.04)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect x="0" y="0" width="900" height="520" fill="url(#capture-grid)" />
            <rect x="0" y="0" width="900" height="520" fill="url(#capture-micro-grid)" />

            {sport === "beisbol" ? (
              <>
                <path d="M210 430 L210 70 A360 360 0 0 1 570 430 Z" fill="rgba(10,22,38,0.82)" stroke={STROKE} strokeWidth="1.2" />

                <path
                  d="M210 430 L210 70 A360 360 0 0 1 570 430 Z M210 430 L210 130 A300 300 0 0 1 510 430 Z"
                  fill={getZoneFill(activeZone.id, "foul-territory")}
                  fillRule="evenodd"
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("foul-territory")}
                />

                <path
                  d="M210 430 L210 130 A300 300 0 0 1 510 430 Z M210 430 L210 175 A255 255 0 0 1 465 430 Z"
                  fill={getZoneFill(activeZone.id, "warning-track")}
                  fillRule="evenodd"
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("warning-track")}
                />

                <path
                  d="M210 430 L210 175 A255 255 0 0 1 465 430 Z M210 430 L210 285 A145 145 0 0 1 355 430 Z"
                  fill={getZoneFill(activeZone.id, "outfield")}
                  fillRule="evenodd"
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("outfield")}
                />

                <path
                  d="M210 430 L210 285 A145 145 0 0 1 355 430 Z"
                  fill={getZoneFill(activeZone.id, "infield")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("infield")}
                />

                <path
                  d="M594 294 C626 278 669 278 701 294 C713 305 713 332 701 343 C669 359 626 359 594 343 C582 332 582 305 594 294 Z"
                  fill={getZoneFill(activeZone.id, "bullpen")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("bullpen")}
                />

                <path d="M210 430 L210 130" stroke={STROKE} strokeWidth="1.2" strokeDasharray="4 6" />
                <path d="M210 430 L510 430" stroke={STROKE} strokeWidth="1.2" strokeDasharray="4 6" />
                <path d="M210 430 L280 360" stroke={STROKE} strokeWidth="1" />
                <path d="M280 360 L350 290" stroke={STROKE} strokeWidth="1" />
                <circle cx="278" cy="360" r="5" fill="none" stroke={STROKE} strokeWidth="1" />
                <circle cx="320" cy="320" r="4" fill="none" stroke={STROKE} strokeWidth="1" />
              </>
            ) : null}

            {sport === "football" ? (
              <>
                <rect x="80" y="80" width="740" height="360" fill="rgba(10,22,38,0.8)" stroke={STROKE} strokeWidth="1.2" />

                <path
                  d="M80 80 H820 V440 H80 Z M102 102 H798 V418 H102 Z"
                  fill={getZoneFill(activeZone.id, "perimeter")}
                  fillRule="evenodd"
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("perimeter")}
                />

                <rect
                  x="102"
                  y="102"
                  width="696"
                  height="34"
                  fill={getZoneFill(activeZone.id, "sideline-a")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("sideline-a")}
                />

                <rect
                  x="102"
                  y="384"
                  width="696"
                  height="34"
                  fill={getZoneFill(activeZone.id, "sideline-b")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("sideline-b")}
                />

                <rect
                  x="102"
                  y="136"
                  width="58"
                  height="248"
                  fill={getZoneFill(activeZone.id, "end-zone-a")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("end-zone-a")}
                />

                <rect
                  x="740"
                  y="136"
                  width="58"
                  height="248"
                  fill={getZoneFill(activeZone.id, "end-zone-b")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("end-zone-b")}
                />

                <rect
                  x="160"
                  y="136"
                  width="580"
                  height="248"
                  fill={getZoneFill(activeZone.id, "playing-field")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("playing-field")}
                />

                {Array.from({ length: 19 }).map((_, index) => {
                  const x = 160 + index * (580 / 18)
                  const isMajor = index % 2 === 0
                  return (
                    <line
                      key={`yard-${index}`}
                      x1={x}
                      y1="136"
                      x2={x}
                      y2="384"
                      stroke={isMajor ? "rgba(217,238,255,0.6)" : "rgba(217,238,255,0.25)"}
                      strokeWidth={isMajor ? 1 : 0.7}
                    />
                  )
                })}
              </>
            ) : null}

            {sport === "soccer" ? (
              <>
                <rect x="140" y="60" width="620" height="400" fill="rgba(10,22,38,0.8)" stroke={STROKE} strokeWidth="1.2" />

                <path
                  d="M140 60 H760 V460 H140 Z M158 78 H742 V442 H158 Z"
                  fill={getZoneFill(activeZone.id, "perimeter-sideline")}
                  fillRule="evenodd"
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("perimeter-sideline")}
                />

                <rect
                  x="262"
                  y="78"
                  width="376"
                  height="364"
                  fill={getZoneFill(activeZone.id, "pz")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("pz")}
                />

                <rect
                  x="158"
                  y="140"
                  width="104"
                  height="240"
                  fill={getZoneFill(activeZone.id, "gaa")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("gaa")}
                />

                <rect
                  x="638"
                  y="140"
                  width="104"
                  height="240"
                  fill={getZoneFill(activeZone.id, "gao")}
                  stroke={STROKE}
                  strokeWidth="1"
                  style={{ transition: "fill 180ms ease" }}
                  onMouseEnter={() => setActiveZoneId("gao")}
                />

                <rect x="158" y="188" width="52" height="144" fill="none" stroke={STROKE} strokeWidth="1" />
                <rect x="690" y="188" width="52" height="144" fill="none" stroke={STROKE} strokeWidth="1" />

                <line x1="450" y1="78" x2="450" y2="442" stroke={STROKE} strokeWidth="1" />
                <circle cx="450" cy="260" r="56" fill="none" stroke={STROKE} strokeWidth="1" />
                <path d="M262 204 A56 56 0 0 1 262 316" fill="none" stroke={STROKE} strokeWidth="1" />
                <path d="M638 204 A56 56 0 0 0 638 316" fill="none" stroke={STROKE} strokeWidth="1" />

                <path d="M172 78 A14 14 0 0 0 158 92" fill="none" stroke={STROKE} strokeWidth="1" />
                <path d="M728 78 A14 14 0 0 1 742 92" fill="none" stroke={STROKE} strokeWidth="1" />
                <path d="M172 442 A14 14 0 0 1 158 428" fill="none" stroke={STROKE} strokeWidth="1" />
                <path d="M728 442 A14 14 0 0 0 742 428" fill="none" stroke={STROKE} strokeWidth="1" />
              </>
            ) : null}
          </svg>
        </div>

        <aside className="space-y-3">
          {zones.map((zone) => {
            const active = activeZone.id === zone.id
            return (
              <button
                key={zone.id}
                type="button"
                onMouseEnter={() => setActiveZoneId(zone.id)}
                onFocus={() => setActiveZoneId(zone.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  active ? "border-cyan-400 bg-cyan-500/15" : "border-slate-800 bg-slate-950/60 hover:border-cyan-500/60"
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
