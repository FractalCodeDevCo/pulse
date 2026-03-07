#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { spawn } from "node:child_process"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const ZONE_PATTERNS = [
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
]

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

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim()
}

function bboxFromItems(items) {
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

function centerOf(bbox) {
  return { cx: (bbox.x0 + bbox.x1) / 2, cy: (bbox.y0 + bbox.y1) / 2 }
}

function parseLengthFeet(rawText) {
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

function detectFlags(text) {
  const flags = []
  for (const { key, pattern } of FLAG_PATTERNS) {
    if (pattern.test(text)) flags.push(key)
  }
  return flags
}

function detectZone(text, currentZone = null) {
  for (const zone of ZONE_PATTERNS) {
    if (zone.pattern.test(text)) return zone.key
  }
  return currentZone
}

function parsePileDirection(lines) {
  const text = lines.map((line) => line.text).join(" ")
  const match = text.match(/\bPILE\s*LAY\b[:\s-]*(NORTH|SOUTH|EAST|WEST|LEFT|RIGHT|UP|DOWN|N|S|E|W)\b/i)
  if (!match) return null
  return match[1].toUpperCase()
}

function inferOrientation(rolls) {
  if (rolls.length < 2) return "unknown"
  const centers = rolls.map((roll) => centerOf(roll.bbox))
  const xs = centers.map((point) => point.cx)
  const ys = centers.map((point) => point.cy)
  const xSpread = Math.max(...xs) - Math.min(...xs)
  const ySpread = Math.max(...ys) - Math.min(...ys)
  return xSpread >= ySpread ? "left_to_right" : "top_to_bottom"
}

function buildAdjacency(rolls, maxNeighbors = 3) {
  const adjacency = []
  for (const roll of rolls) {
    const sourceCenter = centerOf(roll.bbox)
    const neighbors = rolls
      .filter((candidate) => candidate.instance_id !== roll.instance_id)
      .map((candidate) => {
        const targetCenter = centerOf(candidate.bbox)
        const distance = Math.hypot(sourceCenter.cx - targetCenter.cx, sourceCenter.cy - targetCenter.cy)
        return {
          instance_id: candidate.instance_id,
          id: candidate.id,
          distance: Math.round(distance * 100) / 100,
        }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxNeighbors)

    adjacency.push({ instance_id: roll.instance_id, id: roll.id, neighbors })
  }
  return adjacency
}

function spatialOrder(rolls, orientation = "left_to_right", serpentine = false) {
  const primaryKey = orientation === "top_to_bottom" ? "cy" : "cx"
  const secondaryKey = orientation === "top_to_bottom" ? "cx" : "cy"
  const withCenter = rolls.map((roll) => ({ ...roll, ...centerOf(roll.bbox) }))
  const sorted = withCenter.sort((a, b) => (a[primaryKey] - b[primaryKey]) || (a[secondaryKey] - b[secondaryKey]))

  if (!serpentine || sorted.length < 4) return sorted

  const groups = []
  const threshold = 48
  for (const item of sorted) {
    const lastGroup = groups[groups.length - 1]
    if (!lastGroup) {
      groups.push([item])
      continue
    }
    const ref = lastGroup[lastGroup.length - 1]
    const delta = Math.abs(item[primaryKey] - ref[primaryKey])
    if (delta <= threshold) {
      lastGroup.push(item)
    } else {
      groups.push([item])
    }
  }

  const serpentineOrder = []
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]
    group.sort((a, b) => a[secondaryKey] - b[secondaryKey])
    if (index % 2 === 1) group.reverse()
    serpentineOrder.push(...group)
  }
  return serpentineOrder
}

function confidenceForSuggestion(parsedLayout, installedCount) {
  let score = 0.55
  if (parsedLayout.rolls.length >= 3) score += 0.1
  if (parsedLayout.orientation !== "unknown") score += 0.1
  if (installedCount > 0) score += 0.1
  if (parsedLayout.notes.some((note) => note.includes("OCR unavailable"))) score -= 0.15
  return Math.max(0.2, Math.min(0.95, Math.round(score * 100) / 100))
}

export function suggest_next_rolls(parsedLayout, installed_rolls = [], options = {}) {
  const installedSet = new Set((installed_rolls ?? []).map((item) => String(item).toUpperCase()))
  const serpentine = options.serpentine === true
  const ordered = spatialOrder(parsedLayout.rolls, parsedLayout.orientation, serpentine)
  const pending = ordered.filter((roll) => !installedSet.has(roll.instance_id.toUpperCase()) && !installedSet.has(roll.id))
  const next = pending.slice(0, 3).map((roll) => ({
    instance_id: roll.instance_id,
    id: roll.id,
    zone: roll.zone,
    length: roll.length,
    bbox: roll.bbox,
  }))
  return {
    next_rolls: next,
    confidence: confidenceForSuggestion(parsedLayout, installedSet.size),
    strategy: serpentine ? "spatial_serpentine" : "spatial_linear",
  }
}

async function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }))
    child.on("error", () => resolve({ code: 1, stdout, stderr: `${command} not available` }))
  })
}

async function hasCommand(command) {
  const result = await runCommand("which", [command])
  return result.code === 0
}

async function extractLinesFromPdfText(pdfPath) {
  const data = await fs.readFile(pdfPath)
  const loadingTask = getDocument({ data: new Uint8Array(data) })
  const pdf = await loadingTask.promise
  const lines = []

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const content = await page.getTextContent()
    const items = content.items
      .filter((item) => item.str && item.transform)
      .map((item) => {
        const str = normalizeText(item.str)
        const x0 = item.transform[4]
        const y0 = item.transform[5]
        const width = item.width || 0
        const height = item.height || 0
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

    const grouped = []
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

async function extractLinesWithOcrFallback(pdfPath, pageCount, notes) {
  const hasPdftoppm = await hasCommand("pdftoppm")
  const hasTesseract = await hasCommand("tesseract")
  if (!hasPdftoppm || !hasTesseract) {
    notes.push("OCR unavailable: install pdftoppm + tesseract for scanned PDFs.")
    return []
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "turf-ocr-"))
  const lines = []

  for (let page = 1; page <= pageCount; page += 1) {
    const outPrefix = path.join(tmpDir, `page_${page}`)
    const render = await runCommand("pdftoppm", ["-f", String(page), "-singlefile", "-png", pdfPath, outPrefix])
    if (render.code !== 0) continue

    const pngPath = `${outPrefix}.png`
    const hocrPath = `${outPrefix}.hocr`
    const ocr = await runCommand("tesseract", [pngPath, outPrefix, "hocr"])
    if (ocr.code !== 0) continue

    const hocrRaw = await fs.readFile(hocrPath, "utf8")
    const linePattern = /class=['"]ocr_line['"][^>]*title=['"][^'"]*bbox (\d+) (\d+) (\d+) (\d+)[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi
    let lineMatch
    while ((lineMatch = linePattern.exec(hocrRaw)) !== null) {
      const x0 = Number(lineMatch[1])
      const y0 = Number(lineMatch[2])
      const x1 = Number(lineMatch[3])
      const y1 = Number(lineMatch[4])
      const clean = normalizeText(lineMatch[5].replace(/<[^>]+>/g, " "))
      if (!clean) continue
      lines.push({
        page,
        text: clean,
        bbox: { x0, y0, x1, y1 },
      })
    }
  }

  notes.push("OCR fallback executed with hOCR.")
  return lines
}

function buildRollRecords(lines) {
  const rolls = []
  const seen = new Set()
  let rollCounter = 0
  let currentZone = null
  const rollSegmentPattern = /(?:(CHOP|SPLIT)\s+)?ROLL\s*["']\s*([A-Z0-9]{1,6})\s*["'](?:\s*-\s*([0-9]{1,3}\s*['`]\s*(?:-\s*[0-9]{1,2}\s*(?:\"|”))?))?/gi

  for (const line of lines) {
    currentZone = detectZone(line.text, currentZone)
    const isRollLine = /\bROLL\b/i.test(line.text)
    const hasFlag = FLAG_PATTERNS.some((flag) => flag.pattern.test(line.text))
    if (!isRollLine && !hasFlag) continue
    if (/COPYRIGHT|SUBMITTAL|INFILL\s*RATIO|INSTALLER|C:\\Users/i.test(line.text)) continue

    const lineFlags = detectFlags(line.text)
    let match
    while ((match = rollSegmentPattern.exec(line.text)) !== null) {
      const rollId = (match[2] || "").toUpperCase()
      if (!rollId || INVALID_ROLL_IDS.has(rollId)) continue
      if (/^\d{3,}$/.test(rollId)) continue
      const prefix = (match[1] || "").toLowerCase()
      const length = match[3] ? parseLengthFeet(match[3]) : parseLengthFeet(line.text)
      const flags = [...lineFlags]
      if (prefix === "chop" && !flags.includes("chop_roll")) flags.push("chop_roll")
      if (prefix === "split" && !flags.includes("split_roll")) flags.push("split_roll")

      const key = `${line.page}:${rollId}:${line.bbox.x0}:${line.bbox.y0}:${length?.raw ?? "nolength"}`
      if (seen.has(key)) continue
      seen.add(key)
      rollCounter += 1

      rolls.push({
        instance_id: `roll_${rollCounter}`,
        id: rollId,
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
        source_text: line.text,
      })
    }
  }
  return rolls
}

export async function parse_turf_plan(pdfPath) {
  const notes = []
  const textExtraction = await extractLinesFromPdfText(pdfPath)
  let lines = textExtraction.lines

  const usefulText = lines.map((line) => line.text).join(" ").length
  if (usefulText < 60) {
    const ocrLines = await extractLinesWithOcrFallback(pdfPath, textExtraction.pageCount, notes)
    if (ocrLines.length > 0) lines = ocrLines
  }

  const rolls = buildRollRecords(lines)
  const orientation = inferOrientation(rolls)
  const pile_direction = parsePileDirection(lines)
  const adjacency = buildAdjacency(rolls)

  return {
    source_pdf: pdfPath,
    created_at: new Date().toISOString(),
    roll_count: rolls.length,
    rolls,
    pile_direction,
    orientation,
    adjacency,
    notes,
  }
}

async function main() {
  const inputPdf = process.argv[2]
  const outputPath = process.argv[3] ?? path.resolve(process.cwd(), "output.json")
  if (!inputPdf) {
    console.error("Usage: node scripts/turf_plan_parser.mjs <input.pdf> [output.json]")
    process.exit(1)
  }

  const parsed = await parse_turf_plan(inputPdf)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(parsed, null, 2), "utf8")

  const suggested = suggest_next_rolls(parsed, [])
  console.log(`Parsed rolls: ${parsed.roll_count}`)
  console.log(`Output: ${outputPath}`)
  console.log(`First suggestions: ${suggested.next_rolls.map((item) => item.id).join(", ") || "none"}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
