import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const runtime = "nodejs"

type RequestBody = {
  projectId?: string
  projectZoneId?: string | null
  captureSessionId?: string
  captureStatus?: "incomplete" | "complete"
  fieldType?: string
  tipoMaterial?: "Arena" | "Goma"
  tipoPasada?: "Sencilla" | "Doble"
  valvula?: number
  bolsasEsperadas?: number
  bolsasUtilizadas?: number
  observaciones?: string
  fotos?: string[]
}

type CaptureStatus = "incomplete" | "complete"

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null

  const mimeType = match[1]
  const base64 = match[2]
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"))

  return { mimeType, bytes }
}

async function uploadMaterialPhoto(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dataUrl: string,
  projectId: string,
  index: number,
): Promise<string> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return dataUrl

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const extension = parsed.mimeType.split("/")[1] || "jpg"
  const filePath = `${projectId}/material/${Date.now()}-${index}.${extension}`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}

function computeDeviation(esperadas: number, utilizadas: number): number {
  return ((utilizadas - esperadas) / esperadas) * 100
}

function computeStatusColor(desviacion: number): "verde" | "amarillo" | "rojo" {
  const abs = Math.abs(desviacion)
  if (abs <= 5) return "verde"
  if (abs <= 12) return "amarillo"
  return "rojo"
}

function computeSuggestion(desviacion: number, status: "verde" | "amarillo" | "rojo"): string {
  if (status !== "rojo") return ""
  if (desviacion > 0) return "Revisar válvula. Posible ajuste a nivel inferior."
  if (desviacion < 0) return "Revisar válvula. Posible ajuste a nivel superior."
  return ""
}

function normalizeCaptureStatus(value: unknown): CaptureStatus {
  return value === "incomplete" ? "incomplete" : "complete"
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody

    if (
      !body.projectId ||
      !body.captureSessionId ||
      !body.tipoMaterial ||
      !body.tipoPasada ||
      !body.valvula ||
      !body.bolsasEsperadas ||
      !body.bolsasUtilizadas
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (body.valvula < 1 || body.valvula > 6) {
      return NextResponse.json({ error: "Valve must be between 1 and 6" }, { status: 400 })
    }

    if (body.bolsasEsperadas <= 0 || body.bolsasUtilizadas <= 0) {
      return NextResponse.json({ error: "Bags must be greater than 0" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const existingRecord = await supabase
      .from("material_records")
      .select("*")
      .eq("project_id", body.projectId)
      .eq("capture_session_id", body.captureSessionId)
      .maybeSingle()

    if (!existingRecord.error && existingRecord.data) {
      return NextResponse.json(existingRecord.data)
    }
    if (existingRecord.error && !isMissingColumnError(existingRecord.error.message)) {
      return NextResponse.json({ error: existingRecord.error.message }, { status: 500 })
    }

    const inputPhotos = body.fotos ?? []
    const fotoUrls: string[] = []
    for (let index = 0; index < inputPhotos.length; index += 1) {
      fotoUrls.push(await uploadMaterialPhoto(supabase, inputPhotos[index], body.projectId, index))
    }

    const desviacion = computeDeviation(body.bolsasEsperadas, body.bolsasUtilizadas)
    const statusColor = computeStatusColor(desviacion)
    const sugerencia = computeSuggestion(desviacion, statusColor)
    const captureStatus = normalizeCaptureStatus(body.captureStatus)

    let { data, error } = await supabase
      .from("material_records")
      .insert({
        project_id: body.projectId,
        project_zone_id: body.projectZoneId ?? null,
        capture_session_id: body.captureSessionId,
        capture_status: captureStatus,
        field_type: body.fieldType ?? null,
        tipo_material: body.tipoMaterial,
        tipo_pasada: body.tipoPasada,
        valvula: body.valvula,
        bolsas_esperadas: body.bolsasEsperadas,
        bolsas_utilizadas: body.bolsasUtilizadas,
        desviacion,
        status_color: statusColor,
        sugerencia: sugerencia || null,
        fotos: fotoUrls,
        observaciones: body.observaciones?.trim() || null,
      })
      .select("*")
      .single()

    if (error && isMissingColumnError(error.message)) {
      const fallback = await supabase
        .from("material_records")
        .insert({
          project_id: body.projectId,
          field_type: body.fieldType ?? null,
          tipo_material: body.tipoMaterial,
          tipo_pasada: body.tipoPasada,
          valvula: body.valvula,
          bolsas_esperadas: body.bolsasEsperadas,
          bolsas_utilizadas: body.bolsasUtilizadas,
          desviacion,
          status_color: statusColor,
          sugerencia: sugerencia || null,
          fotos: fotoUrls,
          observaciones: body.observaciones?.trim() || null,
        })
        .select("*")
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
