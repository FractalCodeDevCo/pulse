import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../lib/supabase/server"
import { CompactionType, PhaseStatus, RollLengthStatus } from "../../../types/rollos"
import { Zone } from "../../../types/zones"

export const runtime = "nodejs"

type RollosBody = {
  id?: string
  projectId?: string
  fieldType?: string
  zone?: Zone
  totalRolls?: number
  totalSeams?: number
  phaseStatus?: PhaseStatus
  compactionType?: CompactionType
  surfaceFirm?: boolean
  moistureOk?: boolean
  doubleCompaction?: boolean
  rollLengthStatus?: RollLengthStatus
  photos?: string[]
  observations?: string
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

async function uploadImage(dataUrlOrUrl: string, projectId: string, index: number): Promise<string> {
  if (!dataUrlOrUrl.startsWith("data:image/")) return dataUrlOrUrl

  const parsed = parseDataUrl(dataUrlOrUrl)
  if (!parsed) return dataUrlOrUrl

  const supabase = getSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pulse-evidence"
  const extension = parsed.mimeType.split("/")[1] || "jpg"
  const filePath = `${projectId}/rollos/${Date.now()}-${index}.${extension}`

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
    .from("rollos")
    .select("*, rollos_photos(image_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RollosBody

    if (
      !body.projectId ||
      !body.zone ||
      body.totalRolls === undefined ||
      body.totalSeams === undefined ||
      !body.phaseStatus ||
      !body.compactionType ||
      !body.rollLengthStatus
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const photos = (body.photos ?? []).slice(0, 3)
    if (photos.length < 1) {
      return NextResponse.json({ error: "At least one photo is required" }, { status: 400 })
    }

    const photoUrls: string[] = []
    for (let index = 0; index < photos.length; index += 1) {
      photoUrls.push(await uploadImage(photos[index], body.projectId, index))
    }

    const supabase = getSupabaseAdminClient()

    const { data: rollosData, error: rollosError } = await supabase
      .from("rollos")
      .insert({
        zone_id: body.zone,
        project_id: body.projectId,
        field_type: body.fieldType ?? null,
        total_rolls: body.totalRolls,
        total_seams: body.totalSeams,
        phase_status: body.phaseStatus,
        compaction_type: body.compactionType,
        surface_firm: body.surfaceFirm ?? false,
        moisture_ok: body.moistureOk ?? false,
        double_compaction: body.doubleCompaction ?? false,
        roll_length_status: body.rollLengthStatus,
        observations: body.observations ?? null,
        created_at: body.timestamp ?? new Date().toISOString(),
      })
      .select("id")
      .single()

    if (rollosError || !rollosData) {
      return NextResponse.json({ error: rollosError?.message ?? "Could not create rollos" }, { status: 500 })
    }

    const photosRows = photoUrls.map((imageUrl) => ({
      rollos_id: rollosData.id,
      image_url: imageUrl,
    }))

    const { error: photosError } = await supabase.from("rollos_photos").insert(photosRows)

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 })
    }

    const { data: fullData, error: fullError } = await supabase
      .from("rollos")
      .select("*, rollos_photos(image_url)")
      .eq("id", rollosData.id)
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
  const body = (await request.json()) as RollosBody
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const updatePayload: Record<string, unknown> = {}
  if (body.totalRolls !== undefined) updatePayload.total_rolls = body.totalRolls
  if (body.totalSeams !== undefined) updatePayload.total_seams = body.totalSeams
  if (body.phaseStatus !== undefined) updatePayload.phase_status = body.phaseStatus
  if (body.compactionType !== undefined) updatePayload.compaction_type = body.compactionType
  if (body.surfaceFirm !== undefined) updatePayload.surface_firm = body.surfaceFirm
  if (body.moistureOk !== undefined) updatePayload.moisture_ok = body.moistureOk
  if (body.doubleCompaction !== undefined) updatePayload.double_compaction = body.doubleCompaction
  if (body.rollLengthStatus !== undefined) updatePayload.roll_length_status = body.rollLengthStatus
  if (body.observations !== undefined) updatePayload.observations = body.observations

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("rollos")
    .update(updatePayload)
    .eq("id", body.id)
    .select("*, rollos_photos(image_url)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as RollosBody
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("rollos").delete().eq("id", body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
