import { getSupabaseAdminClient } from "../supabase/server"

type EventAction = "create" | "update" | "delete" | "upsert"

type CaptureEventInput = {
  projectId: string
  sourceTable: string
  captureId: string
  module: string | null
  action: EventAction
  actorUserId: string | null
  actorEmail: string | null
  beforeData?: unknown
  afterData?: unknown
}

type MetadataVersionInput = {
  projectId: string
  sourceTable: string
  captureId: string
  module: string | null
  metadata: Record<string, unknown>
  editedBy: string | null
  editorEmail: string | null
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("relation") && lower.includes("does not exist")
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("column") && lower.includes("does not exist")
}

function isSchemaCompatibilityError(message: string): boolean {
  return isMissingRelationError(message) || isMissingColumnError(message)
}

export function extractFieldRecordMetadata(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {}
  const root = payload as Record<string, unknown>
  const metadata = root.metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}
  return metadata as Record<string, unknown>
}

export async function recordCaptureEvent(input: CaptureEventInput) {
  const supabase = getSupabaseAdminClient()
  const insert = await supabase.from("capture_change_log").insert({
    project_id: input.projectId,
    source_table: input.sourceTable,
    capture_id: input.captureId,
    module: input.module,
    action: input.action,
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
  })

  if (insert.error && !isSchemaCompatibilityError(insert.error.message)) {
    console.error("[capture-audit] event_insert_failed", {
      error: insert.error.message,
      sourceTable: input.sourceTable,
      captureId: input.captureId,
      action: input.action,
    })
  }
}

export async function recordMetadataVersion(input: MetadataVersionInput) {
  const supabase = getSupabaseAdminClient()

  const maxRes = await supabase
    .from("capture_metadata_versions")
    .select("version")
    .eq("source_table", input.sourceTable)
    .eq("capture_id", input.captureId)
    .order("version", { ascending: false })
    .limit(1)

  let nextVersion = 1
  if (maxRes.error) {
    if (!isSchemaCompatibilityError(maxRes.error.message)) {
      console.error("[capture-audit] metadata_version_read_failed", {
        error: maxRes.error.message,
        sourceTable: input.sourceTable,
        captureId: input.captureId,
      })
      return
    }
  } else if ((maxRes.data ?? []).length > 0) {
    const current = Number((maxRes.data as Array<{ version?: number }>)[0]?.version ?? 0)
    if (Number.isFinite(current) && current > 0) nextVersion = current + 1
  }

  const insert = await supabase.from("capture_metadata_versions").insert({
    project_id: input.projectId,
    source_table: input.sourceTable,
    capture_id: input.captureId,
    module: input.module,
    version: nextVersion,
    metadata: input.metadata,
    edited_by: input.editedBy,
    editor_email: input.editorEmail,
  })

  if (insert.error && !isSchemaCompatibilityError(insert.error.message)) {
    console.error("[capture-audit] metadata_version_insert_failed", {
      error: insert.error.message,
      sourceTable: input.sourceTable,
      captureId: input.captureId,
      version: nextVersion,
    })
  }
}
