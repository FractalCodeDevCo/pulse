import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

import { ParsedPlanRollLayout, ParsedRollSegment, PlanFileRef, PlanAnalysisResult, RollZoneMapEntry } from "./types"
import { buildPlanAnalysisScaffold } from "./scaffold"

type TextLine = {
  page: number
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

const ZONE_PATTERNS: Array<{ key: ParsedRollSegment["zone"]; pattern: RegExp }> = [
  { key: "infield", pattern: /\bINFIELD\b/i },
  { key: "outfield", pattern: /\bOUTFIELD\b/i },
  { key: "warning_track", pattern: /\bWARNING\s*TRACK\b/i },
  { key: "foul_territory", pattern: /\bFOUL\s*TERRITORY\b/i },
  { key: "bullpen", pattern: /\bBULLPEN\b/i },
  { key: "sideline", pattern: /\bSIDELINE|SIDELINES\b/i },
  { key: "endzone", pattern: /\bEND\s*ZONE\b/i },
]

const FLAG_PATTERNS = [
  { key: "chop_roll", pattern: /\bCHOP\s*ROLL\b/i },
  { key: "split_roll", pattern: /\bSPLIT\s*ROLL\b/i },
  { key: "pile_lay", pattern: /\bPILE\s*LAY\b/i },
] as const

const INVALID_ROLL_IDS = new Set([
  "THIS",
  "THAT",
  "FIELD",
  "RATIO",
  "INFILL",
  "TYPE",
  "COLOR",
  "PRODUCT",
  "COPYRIGHT",
  "ROLL",
  "LANE",
  "LAYOUT",
  "RESERVED",
  "INSTALLER",
  "SUBMITTAL",
  "APPROVED",
  "OUT",
  "IN",
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
])

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function bboxFromItems(items: Array<{ x0: number; y0: number; x1: number; y1: number }>) {
  let x0 = Number.POSITIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (const item of items) {
    x0 = Math.min(x0, item.x0)
    y0 = Math.min(y0, item.y0)
    x1 = Math.max(x1, item.x1)
    y1 = Math.max(y1, item.y1)
  }
  return { x0, y0, x1, y1 }
}

function centerOf(bbox: { x0: number; y0: number; x1: number; y1: number }) {
  return { cx: (bbox.x0 + bbox.x1) / 2, cy: (bbox.y0 + bbox.y1) / 2 }
}

function detectZone(text: string, currentZone: ParsedRollSegment["zone"] | null): ParsedRollSegment["zone"] {
  for (const zone of ZONE_PATTERNS) {
    if (zone.pattern.test(text)) return zone.key
  }
  return currentZone ?? "unknown"
}

function detectFlags(text: string): string[] {
  const flags: string[] = []
  for (const { key, pattern } of FLAG_PATTERNS) {
    if (pattern.test(text)) flags.push(key)
  }
  return flags
}

function parseLengthFeet(rawText: string): { raw: string; feet: number } | null {
  const normalized = rawText.replace(/[–—]/g, "-")
  const match = normalized.match(/(\d{1,3})\s*['`]\s*(?:[- ]\s*(\d{1,2})\s*(?:\"|”))?/i)
  if (!match) return null
  const feet = Number(match[1])
  const inches = match[2] ? Number(match[2]) : 0
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null
  return {
    raw: match[0],
    feet: Math.round((feet + inches / 12) * 1000) / 1000,
  }
}

async function runCommand(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }))
    child.on("error", () => resolve({ code: 1, stdout, stderr: `${command} unavailable` }))
  })
}

async function hasCommand(command: string): Promise<boolean> {
  const result = await runCommand("which", [command])
  return result.code === 0
}

function parsePileDirection(lines: TextLine[]): string | null {
  const text = lines.map((line) => line.text).join(" ")
  const match = text.match(/\bPILE\s*LAY\b[:\s-]*(NORTH|SOUTH|EAST|WEST|LEFT|RIGHT|UP|DOWN|N|S|E|W)\b/i)
  if (!match) return null
  return match[1].toUpperCase()
}

function inferOrientation(rolls: ParsedRollSegment[]): "left_to_right" | "top_to_bottom" | "unknown" {
  if (rolls.length < 2) return "unknown"
  const centers = rolls.map((roll) => centerOf(roll.bbox))
  const xs = centers.map((point) => point.cx)
  const ys = centers.map((point) => point.cy)
  const xSpread = Math.max(...xs) - Math.min(...xs)
  const ySpread = Math.max(...ys) - Math.min(...ys)
  return xSpread >= ySpread ? "left_to_right" : "top_to_bottom"
}

function buildAdjacency(rolls: ParsedRollSegment[], maxNeighbors = 3): ParsedPlanRollLayout["adjacency"] {
  const adjacency: ParsedPlanRollLayout["adjacency"] = []
  for (const roll of rolls) {
    const sourceCenter = centerOf(roll.bbox)
    const neighbors = rolls
      .filter((candidate) => candidate.instanceId !== roll.instanceId)
      .map((candidate) => {
        const targetCenter = centerOf(candidate.bbox)
        const distance = Math.hypot(sourceCenter.cx - targetCenter.cx, sourceCenter.cy - targetCenter.cy)
        return {
          instanceId: candidate.instanceId,
          id: candidate.id,
          distance: Math.round(distance * 100) / 100,
        }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxNeighbors)

    adjacency.push({ instanceId: roll.instanceId, id: roll.id, neighbors })
  }
  return adjacency
}

async function extractTextLinesFromPdfBytes(pdfBytes: Buffer): Promise<{ lines: TextLine[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) })
  const pdf = await loadingTask.promise
  const lines: TextLine[] = []

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const content = await page.getTextContent()
    const items = content.items
      .filter((item) => "str" in item && "transform" in item)
      .map((item) => {
        const textItem = item as unknown as {
          str: string
          transform: number[]
          width?: number
          height?: number
        }
        const str = normalizeText(textItem.str)
        const x0 = textItem.transform[4]
        const y0 = textItem.transform[5]
        const width = textItem.width ?? 0
        const height = textItem.height ?? 0
        return {
          str,
          x0,
          y0,
          x1: x0 + width,
          y1: y0 + height,
          page: pageIndex,
        }
      })
      .filter((item) => item.str.length > 0)

    items.sort((a, b) => (b.y0 - a.y0) || (a.x0 - b.x0))

    const grouped: Array<{ anchorY: number; items: typeof items }> = []
    for (const item of items) {
      const match = grouped.find((line) => Math.abs(line.anchorY - item.y0) < 3)
      if (match) {
        match.items.push(item)
      } else {
        grouped.push({ anchorY: item.y0, items: [item] })
      }
    }

    for (const group of grouped) {
      group.items.sort((a, b) => a.x0 - b.x0)
      const text = normalizeText(group.items.map((item) => item.str).join(" "))
      if (!text) continue
      lines.push({
        page: pageIndex,
        text,
        bbox: bboxFromItems(group.items),
      })
    }
  }

  return { lines, pageCount: pdf.numPages }
}

async function extractLinesWithOcrFallback(pdfBytes: Buffer, pageCount: number, notes: string[]): Promise<TextLine[]> {
  const hasPdftoppm = await hasCommand("pdftoppm")
  const hasTesseract = await hasCommand("tesseract")
  if (!hasPdftoppm || !hasTesseract) {
    notes.push("OCR fallback unavailable (install pdftoppm + tesseract).")
    return []
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-ocr-"))
  const pdfPath = path.join(tmpDir, "input.pdf")
  await fs.writeFile(pdfPath, pdfBytes)
  const lines: TextLine[] = []

  for (let page = 1; page <= pageCount; page += 1) {
    const outPrefix = path.join(tmpDir, `page_${page}`)
    const render = await runCommand("pdftoppm", ["-f", String(page), "-singlefile", "-png", pdfPath, outPrefix])
    if (render.code !== 0) continue
    const pngPath = `${outPrefix}.png`
    const hocrPath = `${outPrefix}.hocr`
    const ocr = await runCommand("tesseract", [pngPath, outPrefix, "hocr"])
    if (ocr.code !== 0) continue

    const hocrRaw = await fs.readFile(hocrPath, "utf8")
    const linePattern =
      /class=['"]ocr_line['"][^>]*title=['"][^'"]*bbox (\d+) (\d+) (\d+) (\d+)[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi
    let lineMatch: RegExpExecArray | null
    while ((lineMatch = linePattern.exec(hocrRaw)) !== null) {
      const clean = normalizeText(lineMatch[5].replace(/<[^>]+>/g, " "))
      if (!clean) continue
      lines.push({
        page,
        text: clean,
        bbox: {
          x0: Number(lineMatch[1]),
          y0: Number(lineMatch[2]),
          x1: Number(lineMatch[3]),
          y1: Number(lineMatch[4]),
        },
      })
    }
  }

  if (lines.length > 0) notes.push("OCR fallback executed.")
  return lines
}

function buildRollRecords(lines: TextLine[], sourceFile: string): ParsedRollSegment[] {
  const rolls: ParsedRollSegment[] = []
  const seen = new Set<string>()
  let currentZone: ParsedRollSegment["zone"] | null = null
  let rollCounter = 0
  const rollSegmentPattern =
    /(?:(CHOP|SPLIT)\s+)?ROLL\s*["']\s*([A-Z0-9]{1,6})\s*["'](?:\s*-\s*([0-9]{1,3}\s*['`]\s*(?:-\s*[0-9]{1,2}\s*(?:\"|”))?))?/gi

  for (const line of lines) {
    currentZone = detectZone(line.text, currentZone)
    const isRollLine = /\bROLL\b/i.test(line.text)
    const hasFlag = FLAG_PATTERNS.some((flag) => flag.pattern.test(line.text))
    if (!isRollLine && !hasFlag) continue
    if (/COPYRIGHT|SUBMITTAL|INFILL\s*RATIO|INSTALLER|C:\\Users/i.test(line.text)) continue

    const lineFlags = detectFlags(line.text)
    let match: RegExpExecArray | null
    while ((match = rollSegmentPattern.exec(line.text)) !== null) {
      const id = (match[2] || "").toUpperCase()
      if (!id || INVALID_ROLL_IDS.has(id)) continue
      if (/^\d{3,}$/.test(id)) continue
      const prefix = (match[1] || "").toLowerCase()
      const length = match[3] ? parseLengthFeet(match[3]) : parseLengthFeet(line.text)
      const flags = [...lineFlags]
      if (prefix === "chop" && !flags.includes("chop_roll")) flags.push("chop_roll")
      if (prefix === "split" && !flags.includes("split_roll")) flags.push("split_roll")

      const key = `${line.page}:${id}:${line.bbox.x0}:${line.bbox.y0}:${length?.raw ?? "none"}`
      if (seen.has(key)) continue
      seen.add(key)
      rollCounter += 1

      rolls.push({
        instanceId: `roll_${rollCounter}`,
        id,
        length,
        bbox: {
          page: line.page,
          x0: Math.round(line.bbox.x0 * 100) / 100,
          y0: Math.round(line.bbox.y0 * 100) / 100,
          x1: Math.round(line.bbox.x1 * 100) / 100,
          y1: Math.round(line.bbox.y1 * 100) / 100,
        },
        zone: currentZone ?? "unknown",
        flags,
        sourceText: line.text,
        sourceFile,
      })
    }
  }

  return rolls
}

function toZoneKey(zone: ParsedRollSegment["zone"]): RollZoneMapEntry["zoneKey"] {
  if (zone === "infield" || zone === "outfield" || zone === "warning_track" || zone === "sideline" || zone === "endzone") {
    return zone
  }
  return "generic"
}

export async function parseTurfPlanPdfBytes(pdfBytes: Buffer, sourceFile: string): Promise<ParsedPlanRollLayout> {
  const notes: string[] = []
  const textExtraction = await extractTextLinesFromPdfBytes(pdfBytes)
  let lines = textExtraction.lines
  const usefulTextSize = lines.map((line) => line.text).join(" ").length
  if (usefulTextSize < 60) {
    const ocrLines = await extractLinesWithOcrFallback(pdfBytes, textExtraction.pageCount, notes)
    if (ocrLines.length > 0) lines = ocrLines
  }

  const rolls = buildRollRecords(lines, sourceFile)
  return {
    rolls,
    pileDirection: parsePileDirection(lines),
    orientation: inferOrientation(rolls),
    adjacency: buildAdjacency(rolls),
    notes,
  }
}

export function buildPlanAnalysisFromLayouts(
  projectId: string,
  files: PlanFileRef[],
  layouts: ParsedPlanRollLayout[],
): PlanAnalysisResult {
  const base = buildPlanAnalysisScaffold(projectId, files)
  const allRolls = layouts.flatMap((layout) => layout.rolls)
  const uniqueLabels = [...new Set(allRolls.map((roll) => roll.id))]

  const zoneMap = new Map<RollZoneMapEntry["zoneKey"], { labels: Set<string>; total: number }>()
  for (const roll of allRolls) {
    const zoneKey = toZoneKey(roll.zone)
    const current = zoneMap.get(zoneKey) ?? { labels: new Set<string>(), total: 0 }
    current.labels.add(roll.id)
    current.total += roll.length?.feet ?? 0
    zoneMap.set(zoneKey, current)
  }
  const rollZoneMap: RollZoneMapEntry[] = [...zoneMap.entries()].map(([zoneKey, value]) => ({
    zoneKey,
    labels: [...value.labels].sort(),
    totalLinearFt: value.total > 0 ? Number(value.total.toFixed(2)) : null,
  }))

  const detectedRolls = uniqueLabels
    .map((label) => {
      const rows = allRolls.filter((roll) => roll.id === label)
      const totalLinearFt = rows.reduce((sum, row) => sum + (row.length?.feet ?? 0), 0)
      const chopCount = rows.filter((row) => row.flags.includes("chop_roll")).length
      const splitCount = rows.filter((row) => row.flags.includes("split_roll")).length
      return {
        label,
        totalLinearFt: totalLinearFt > 0 ? Number(totalLinearFt.toFixed(2)) : null,
        segmentCount: rows.length,
        chopCount,
        splitCount,
        sourceFiles: [...new Set(rows.map((row) => row.sourceFile))],
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const totalLinearFt = detectedRolls.reduce((sum, item) => sum + (item.totalLinearFt ?? 0), 0)
  const choppedSegments = detectedRolls.reduce((sum, item) => sum + item.chopCount, 0)
  const splitSegments = detectedRolls.reduce((sum, item) => sum + item.splitCount, 0)
  const rollLayout: ParsedPlanRollLayout = {
    rolls: allRolls,
    pileDirection: layouts.find((layout) => layout.pileDirection)?.pileDirection ?? null,
    orientation: layouts.find((layout) => layout.orientation !== "unknown")?.orientation ?? "unknown",
    adjacency: (() => {
      const out: ParsedPlanRollLayout["adjacency"] = []
      for (const layout of layouts) {
        out.push(...layout.adjacency)
      }
      return out
    })(),
    notes: layouts.flatMap((layout) => layout.notes),
  }

  return {
    ...base,
    status: allRolls.length > 0 ? "parsed" : "scaffold",
    detectedRolls,
    rollZoneMap: rollZoneMap.length > 0 ? rollZoneMap : base.rollZoneMap,
    rollLayout,
    stats: {
      uniqueRollLabels: detectedRolls.length,
      rollSegments: allRolls.length,
      choppedSegments,
      splitSegments,
      totalLinearFt: totalLinearFt > 0 ? Number(totalLinearFt.toFixed(2)) : null,
      avgLinearFtPerRoll:
        detectedRolls.length > 0 && totalLinearFt > 0 ? Number((totalLinearFt / detectedRolls.length).toFixed(2)) : null,
    },
    notes: [
      ...base.notes,
      allRolls.length > 0 ? "Roll layout parsed from uploaded PDF bytes." : "No roll labels detected in uploaded PDF bytes.",
      ...rollLayout.notes,
    ],
    nextActions: [
      "Validate detected labels by zone in project setup.",
      "Use zone map to suggest optional roll labels during Roll Placement capture.",
    ],
  }
}
