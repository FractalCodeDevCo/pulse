import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { CompactacionType, TrafficLightStatus } from "../../../types/compactacion"
import { Zone } from "../../../types/zones"

export const runtime = "nodejs"

type CompactacionBody = {
  id?: string
  projectId?: string
  fieldType?: string
  zone?: Zone
  compactacionType?: CompactacionType
  directionAlignedToRolls?: boolean
  surfaceFirm?: boolean
  moistureOk?: boolean
  trafficLightStatus?: TrafficLightStatus
  photos?: string[]
  observations?: string
  crewId?: string
  timestamp?: string
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null

  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  }
}

async function uploadImage(
  dataUrlOrUrl: string,
  projectId: string,
  index: number,
): Promise<string> {
  if (!dataUrlOrUrl.startsWith("data:image/")) return dataUrlOrUrl

  const parsed = parseDataUrl(dataUrlOrUrl)
  if (!parsed) return dataUrlOrUrl

  const supabase = getSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const extension = parsed.mimeType.split("/")[1] || "jpg"
  const filePath = `${projectId}/compactacion/${Date.now()}-${index}.${extension}`

  const { error } = await supabase.storage.from(bucket).upload(filePath, parsed.bytes, {
    contentType: parsed.mimeType,
    upsert: true,
  })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("compactacion")
    .select("*, compactacion_photos(image_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompactacionBody

    if (!body.projectId || !body.zone || !body.compactacionType || !body.trafficLightStatus || !body.crewId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const photos = (body.photos ?? []).slice(0, 2)
    if (photos.length < 1) {
      return NextResponse.json({ error: "At least one photo is required" }, { status: 400 })
    }

    const photoUrls: string[] = []
    for (let index = 0; index < photos.length; index += 1) {
      photoUrls.push(await uploadImage(photos[index], body.projectId, index))
    }

    const supabase = getSupabaseAdminClient()
    const { data: compactacionData, error: compactacionError } = await supabase
      .from("compactacion")
      .insert({
        zone_id: body.zone,
        project_id: body.projectId,
        field_type: body.fieldType ?? null,
        compactacion_type: body.compactacionType,
        direction_aligned_to_rolls: body.directionAlignedToRolls ?? false,
        surface_firm: body.surfaceFirm ?? false,
        moisture_ok: body.moistureOk ?? false,
        traffic_light_status: body.trafficLightStatus,
        observations: body.observations ?? null,
        crew_id: body.crewId,
        created_at: body.timestamp ?? new Date().toISOString(),
      })
      .select("id")
      .single()

    if (compactacionError || !compactacionData) {
      return NextResponse.json({ error: compactacionError?.message ?? "Could not create compactacion" }, { status: 500 })
    }

    const photosRows = photoUrls.map((imageUrl) => ({
      compactacion_id: compactacionData.id,
      image_url: imageUrl,
    }))

    const { error: photosError } = await supabase.from("compactacion_photos").insert(photosRows)

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 })
    }

    const { data: fullData, error: fullError } = await supabase
      .from("compactacion")
      .select("*, compactacion_photos(image_url)")
      .eq("id", compactacionData.id)
      .single()

    if (fullError) {
      return NextResponse.json({ error: fullError.message }, { status: 500 })
    }

    return NextResponse.json(fullData)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as CompactacionBody
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const updatePayload: Record<string, unknown> = {}
  if (body.compactacionType !== undefined) updatePayload.compactacion_type = body.compactacionType
  if (body.trafficLightStatus !== undefined) updatePayload.traffic_light_status = body.trafficLightStatus
  if (body.observations !== undefined) updatePayload.observations = body.observations

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("compactacion")
    .update(updatePayload)
    .eq("id", body.id)
    .select("*, compactacion_photos(image_url)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as CompactacionBody
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("compactacion").delete().eq("id", body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
