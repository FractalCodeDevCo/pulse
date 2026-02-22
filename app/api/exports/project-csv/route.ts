import { NextResponse } from "next/server"

import { captureRowsToCsv, fetchCaptureExportRows, normalizeDateParam } from "../../../../lib/dataScience"

export const runtime = "nodejs"

function buildFileName(projectId: string, fromDate: string | null, toDate: string | null): string {
  const fromPart = fromDate ?? "all"
  const toPart = toDate ?? "all"
  return `pulse-captures-${projectId}-${fromPart}-${toPart}.csv`
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

    const { rows, relationWarnings } = await fetchCaptureExportRows({
      projectId,
      fromDate,
      toDate,
    })

    const csv = captureRowsToCsv(rows)
    const fileName = buildFileName(projectId, fromDate, toDate)

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
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
