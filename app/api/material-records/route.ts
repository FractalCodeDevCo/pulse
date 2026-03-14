import { NextResponse } from "next/server"

import { requireAuth } from "../../../lib/auth/guard"
import { writeUnifiedCaptures } from "../../../lib/captures/writeUnifiedCaptures"
import { computeMaterialPass } from "../../../lib/metricsV0"
import { uploadDataUrlToStorage } from "../../../lib/storage/safeUpload"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { resolveZoneRecordType, validatePhaseByZoneType } from "../../../lib/zonePhaseRules"

export const runtime = "nodejs"

type RequestBody = {
  projectId?: string
  projectZoneId?: string | null
  zoneType?: string | null
  captureSessionId?: string
  captureStatus?: "incomplete" | "complete"
  passNumber?: number
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

async function uploadMaterialPhoto(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dataUrl: string,
  projectId: string,
  index: number,
): Promise<string> {
  return uploadDataUrlToStorage({
    supabase,
    dataUrlOrUrl: dataUrl,
    projectId,
    moduleName: "material",
    keyPath: `material_${index}`,
    fallbackToOriginal: true,
  })
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

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

function hasOnConflictConstraintError(message: string): boolean {
  return message.toLowerCase().includes("there is no unique or exclusion constraint matching the on conflict specification")
}

function isSchemaCompatibilityError(message: string): boolean {
  return isMissingColumnError(message) || isMissingRelationError(message) || hasOnConflictConstraintError(message)
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as RequestBody
    const zoneRecordType = resolveZoneRecordType(body.zoneType)
    const phaseValidation = validatePhaseByZoneType({
      zoneRecordType,
      phase: "MATERIAL_FINAL",
    })
    if (!phaseValidation.ok) {
      return NextResponse.json({ error: phaseValidation.error }, { status: 400 })
    }

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

    const projectId = body.projectId

    if (body.valvula < 1 || body.valvula > 6) {
      return NextResponse.json({ error: "Valve must be between 1 and 6" }, { status: 400 })
    }

    if (body.bolsasEsperadas <= 0 || body.bolsasUtilizadas <= 0) {
      return NextResponse.json({ error: "Bags must be greater than 0" }, { status: 400 })
    }

    const desviacion = computeDeviation(body.bolsasEsperadas, body.bolsasUtilizadas)
    const statusColor = computeStatusColor(desviacion)
    const sugerencia = computeSuggestion(desviacion, statusColor)
    const materialMetrics = computeMaterialPass({
      bagsExpectedPerPass: body.bolsasEsperadas,
      bagsUsed: body.bolsasUtilizadas,
      valveSetting: body.valvula,
    })
    const passNumber =
      typeof body.passNumber === "number" && Number.isInteger(body.passNumber) && body.passNumber > 0
        ? body.passNumber
        : body.tipoPasada === "Doble"
          ? 2
          : 1
    const summary = {
      module: "material",
      deviation_ratio: materialMetrics.deviation,
      deviation_percent: Number((materialMetrics.deviation * 100).toFixed(2)),
      status_color: statusColor,
      valve_current: body.valvula,
      valve_delta: materialMetrics.valveDelta,
      valve_next: materialMetrics.valveNext,
      suggestion: sugerencia || null,
    }

    const supabase = getSupabaseAdminClient()
    const existingRecord = await supabase
      .from("material_records")
      .select("*")
      .eq("project_id", projectId)
      .eq("capture_session_id", body.captureSessionId)
      .maybeSingle()

    if (!existingRecord.error && existingRecord.data) {
      return NextResponse.json({
        ...existingRecord.data,
        summary,
      })
    }
    if (existingRecord.error && !isMissingColumnError(existingRecord.error.message)) {
      return NextResponse.json({ error: existingRecord.error.message }, { status: 500 })
    }

    const inputPhotos = body.fotos ?? []
    const fotoUrls: string[] = []
    for (let index = 0; index < inputPhotos.length; index += 1) {
      fotoUrls.push(await uploadMaterialPhoto(supabase, inputPhotos[index], projectId, index))
    }

    const captureStatus = normalizeCaptureStatus(body.captureStatus)

    let { data, error } = await supabase
      .from("material_records")
      .insert({
        project_id: projectId,
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
          project_id: projectId,
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

    if (fotoUrls.length > 0) {
      try {
        await writeUnifiedCaptures({
          supabase,
          captures: fotoUrls.map((imageUrl) => ({
            projectId,
            phase: "material",
            imageUrl,
            crew: auth.context.email,
            notes: body.observaciones?.trim() || null,
            metadata: {
              projectZoneId: body.projectZoneId ?? null,
              captureSessionId: body.captureSessionId,
              captureStatus,
              fieldType: body.fieldType ?? null,
              zoneType: body.zoneType ?? null,
              passNumber,
              tipoMaterial: body.tipoMaterial,
              tipoPasada: body.tipoPasada,
              valvula: body.valvula,
              bolsasEsperadas: body.bolsasEsperadas,
              bolsasUtilizadas: body.bolsasUtilizadas,
              deviation: materialMetrics.deviation,
              valveNextDelta: materialMetrics.valveDelta,
              valveNextSetting: materialMetrics.valveNext,
            },
          })),
        })
      } catch (captureError) {
        console.error("[material-api] unified_captures_insert_failed", {
          error: captureError instanceof Error ? captureError.message : "unknown",
          projectId,
          projectZoneId: body.projectZoneId,
        })
      }
    }

    console.log("[material-api] save_success", {
      id: data?.id ?? null,
      projectId,
      projectZoneId: body.projectZoneId ?? null,
      deviation: summary.deviation_percent,
      valveNext: summary.valve_next,
    })

    return NextResponse.json({
      ...data,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
