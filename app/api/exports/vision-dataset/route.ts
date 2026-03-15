import { NextResponse } from "next/server"

import { fetchVisionDatasetRows, normalizeDateParam, visionDatasetRowsToCsv } from "../../../../lib/dataScience"

export const runtime = "nodejs"

function buildFileName(projectId: string, fromDate: string | null, toDate: string | null): string {
  const fromPart = fromDate ?? "all"
  const toPart = toDate ?? "all"
  return `pulse-vision-dataset-${projectId}-${fromPart}-${toPart}.csv`
}

function parseIncludeIncidence(value: string | null): boolean {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  return !(normalized === "0" || normalized === "false" || normalized === "no")
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("project")
    if (!projectId) {
      return NextResponse.json({ error: "project is required" }, { status: 400 })
    }

    const fromDate = normalizeDateParam(searchParams.get("from"))
    const toDate = normalizeDateParam(searchParams.get("to"))
    const includeIncidence = parseIncludeIncidence(searchParams.get("includeIncidence"))

    const { rows, relationWarnings } = await fetchVisionDatasetRows({
      projectId,
      fromDate,
      toDate,
      includeIncidence,
    })

    const csv = visionDatasetRowsToCsv(rows)
    const fileName = buildFileName(projectId, fromDate, toDate)

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
        "X-Pulse-Row-Count": String(rows.length),
        "X-Pulse-Relation-Warnings": relationWarnings.join(","),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
