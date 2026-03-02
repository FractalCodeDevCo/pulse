#!/usr/bin/env node

import path from "node:path"
import fs from "node:fs/promises"
import { parse_turf_plan, suggest_next_rolls } from "./turf_plan_parser.mjs"

async function main() {
  const inputPdf =
    process.argv[2] ||
    "/Users/tiro/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard/items/A019C87D-2C86-40E9-ACFE-A7DA89EA23EA/Fields 1-4 + Large Batting Cage Rev 1 - CD.pdf"
  const outputPath = process.argv[3] || path.resolve(process.cwd(), "output", "plan-parser", "output.json")

  const parsed = await parse_turf_plan(inputPdf)
  const suggestion = suggest_next_rolls(parsed, [], { serpentine: false })
  const payload = {
    ...parsed,
    suggestion_preview: suggestion,
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8")

  console.log(`input: ${inputPdf}`)
  console.log(`output: ${outputPath}`)
  console.log(`rolls: ${parsed.roll_count}`)
  console.log(`orientation: ${parsed.orientation}`)
  console.log(`pile_direction: ${parsed.pile_direction ?? "unknown"}`)
  console.log(`suggested: ${suggestion.next_rolls.map((item) => item.id).join(", ") || "none"}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
