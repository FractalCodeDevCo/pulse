import fs from "fs"
import path from "path"

import { createClient } from "@supabase/supabase-js"

const BATCH_SIZE = 500

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function initEnv() {
  const repoRoot = process.cwd()
  loadEnvFile(path.join(repoRoot, ".env.local"))
  loadEnvFile(path.join(repoRoot, ".env"))
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL and service-role style key.")
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toStringValue(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  return null
}

function pickString(source, keys) {
  if (!isRecord(source)) return null
  for (const key of keys) {
    const value = toStringValue(source[key])
    if (value) return value
  }
  return null
}

function pickNumber(source, keys) {
  if (!isRecord(source)) return null
  for (const key of keys) {
    const value = toNumber(source[key])
    if (value !== null) return value
  }
  return null
}

function pickBoolean(source, keys) {
  if (!isRecord(source)) return null
  for (const key of keys) {
    const value = toBoolean(source[key])
    if (value !== null) return value
  }
  return null
}

function mapWorkflowPhaseToUnified(phaseLike) {
  const phase = phaseLike?.trim().toUpperCase?.() ?? ""
  if (!phase) return "other"
  if (phase.includes("COMPACT")) return "compaction"
  if (phase === "LAYOUT_GENERAL" || phase === "LAYOUT" || phase === "ALIGN") return "align"
  if (phase === "CUT") return "cut"
  if (phase === "ADHESIVE" || phase === "GLUE" || phase === "PEGADA") return "glue"
  if (phase === "ROLL_PLACEMENT" || phase.includes("ROLADO") || phase === "ROLL_INSTALL") return "roll_install"
  if (phase === "SEWING") return "sewing"
  if (phase === "MATERIAL" || phase === "MATERIAL_FINAL") return "material"
  if (phase === "INCIDENCE" || phase === "INCIDENT") return "incident"
  return phase.toLowerCase()
}

function chunk(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function fetchAllRows(supabase, table, columns) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const response = await supabase
      .from(table)
      .select(columns)
      .range(from, to)

    if (response.error) {
      throw new Error(`[${table}] ${response.error.message}`)
    }

    const batch = response.data ?? []
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }

  return rows
}

async function fetchAllRowsWithFallbacks(supabase, table, columnSets) {
  let lastError = null

  for (const columns of columnSets) {
    try {
      return await fetchAllRows(supabase, table, columns)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error(`Unable to read ${table}`)
}

async function assertCaptureSchemaReady(supabase) {
  const response = await supabase
    .from("captures")
    .select("id,module,project_zone_id,capture_session_id,macro_zone,micro_zone,flow_step_key,feet_installed")
    .limit(1)

  if (response.error) {
    throw new Error(
      `Remote captures schema is not ready for backfill: ${response.error.message}. Apply supabase/schema.sql first.`
    )
  }
}

function buildNormalizedCaptureFromExisting(row) {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const payload = isRecord(metadata.payload) ? metadata.payload : {}
  const compaction = isRecord(metadata.compaction) ? metadata.compaction : {}

  return {
    id: row.id,
    module: pickString(metadata, ["module"]),
    field_type: pickString(metadata, ["fieldType", "field_type"]) ?? pickString(payload, ["fieldType", "field_type"]),
    project_zone_id:
      pickString(metadata, ["projectZoneId", "project_zone_id"]) ?? pickString(payload, ["projectZoneId", "project_zone_id"]),
    capture_session_id:
      pickString(metadata, ["captureSessionId", "capture_session_id"]) ??
      pickString(payload, ["captureSessionId", "capture_session_id"]),
    capture_status:
      pickString(metadata, ["captureStatus", "capture_status"]) ??
      pickString(payload, ["captureStatus", "capture_status"]) ??
      "complete",
    macro_zone: pickString(metadata, ["macroZone", "macro_zone"]) ?? pickString(payload, ["macroZone", "macro_zone"]),
    micro_zone: pickString(metadata, ["microZone", "micro_zone"]) ?? pickString(payload, ["microZone", "micro_zone"]),
    flow_step_key:
      pickString(metadata, ["stepKey", "step_key"]) ??
      pickString(payload, ["stepKey", "step_key"]),
    condition_label: pickString(payload, ["condicion", "condition"]),
    feet_installed:
      pickNumber(metadata, ["feetInstalled", "feet_installed"]) ??
      pickNumber(payload, ["ftTotales", "ft_totales", "ft"]),
    glue_buckets:
      pickNumber(metadata, ["glueBuckets", "glue_buckets"]) ??
      pickNumber(payload, ["botesUsados", "botes_usados", "botes"]),
    total_rolls_used:
      pickNumber(metadata, ["totalRollsUsed", "total_rolls_used"]) ??
      pickNumber(payload, ["totalRollsUsed", "total_rolls_used", "totalRolls"]),
    total_seams:
      pickNumber(metadata, ["totalSeams", "total_seams"]) ??
      pickNumber(payload, ["totalSeams", "total_seams", "seams"]),
    roll_length_fit:
      pickString(metadata, ["rollLengthFit", "roll_length_fit"]) ??
      pickString(payload, ["rollLengthFit", "roll_length_fit"]),
    compaction_method:
      pickString(metadata, ["compactionMethod", "compaction_method"]) ??
      pickString(compaction, ["method", "compactionMethod"]),
    compaction_surface_firm:
      pickBoolean(metadata, ["compactionSurfaceFirm", "compaction_surface_firm"]) ??
      pickBoolean(compaction, ["surfaceFirm"]),
    compaction_moisture_ok:
      pickBoolean(metadata, ["compactionMoistureOk", "compaction_moisture_ok"]) ??
      pickBoolean(compaction, ["moistureOk"]),
    compaction_double:
      pickBoolean(metadata, ["compactionDouble", "compaction_double"]) ??
      pickBoolean(compaction, ["doubleCompaction"]),
  }
}

function fieldRecordPhotos(row) {
  const payload = isRecord(row.payload) ? row.payload : {}
  const photos = payload.photosUrls
  if (!Array.isArray(photos)) return []
  return photos.filter((item) => typeof item === "string" && item.trim().length > 0)
}

function photoUrlFromPhotoObject(item) {
  if (typeof item === "string" && item.trim()) return item.trim()
  if (isRecord(item) && typeof item.url === "string" && item.url.trim()) return item.url.trim()
  return null
}

function buildFieldRecordCaptureRows(row) {
  const payload = isRecord(row.payload) ? row.payload : {}
  const metadata = isRecord(payload.metadata) ? payload.metadata : {}
  const photos = fieldRecordPhotos(row)
  const createdAt = toStringValue(row.created_at) ?? new Date().toISOString()
  const zone =
    pickString(payload, ["zone"]) ??
    pickString(metadata, ["zone"]) ??
    toStringValue(row.micro_zone) ??
    toStringValue(row.macro_zone)

  const internalPhase = pickString(metadata, ["internalPhase", "internal_phase"])
  const phase = internalPhase
    ? mapWorkflowPhaseToUnified(internalPhase)
    : row.module === "pegada"
      ? "glue"
      : row.module === "rollos"
        ? "roll_install"
        : row.module === "compactacion"
          ? "compaction"
          : mapWorkflowPhaseToUnified(toStringValue(row.module) ?? "other")

  return photos.map((imageUrl) => ({
    project_id: row.project_id,
    phase,
    image_url: imageUrl,
    timestamp: createdAt,
    crew: pickString(payload, ["crew"]) ?? null,
    zone,
    notes:
      pickString(metadata, ["observaciones", "observation", "notes"]) ??
      pickString(payload, ["notes"]) ??
      null,
    module: toStringValue(row.module),
    field_type: toStringValue(row.field_type) ?? pickString(payload, ["fieldType", "field_type"]),
    project_zone_id:
      toStringValue(row.project_zone_id) ??
      pickString(payload, ["projectZoneId", "project_zone_id"]) ??
      pickString(metadata, ["projectZoneId", "project_zone_id"]),
    capture_session_id:
      toStringValue(row.capture_session_id) ??
      pickString(payload, ["captureSessionId", "capture_session_id"]) ??
      pickString(metadata, ["captureSessionId", "capture_session_id"]),
    capture_status:
      toStringValue(row.capture_status) ??
      pickString(payload, ["captureStatus", "capture_status"]) ??
      "complete",
    macro_zone: toStringValue(row.macro_zone) ?? pickString(metadata, ["macroZone", "macro_zone"]),
    micro_zone: toStringValue(row.micro_zone) ?? pickString(metadata, ["microZone", "micro_zone"]),
    flow_step_key:
      pickString(metadata, ["stepKey", "step_key"]) ??
      pickString(payload, ["stepKey", "step_key"]),
    condition_label: pickString(metadata, ["condicion", "condition"]),
    feet_installed: pickNumber(metadata, ["ftTotales", "ft_totales", "ft"]),
    glue_buckets: pickNumber(metadata, ["botesUsados", "botes_usados", "botes"]),
    total_rolls_used: pickNumber(metadata, ["totalRollsUsed", "total_rolls_used", "totalRolls"]),
    total_seams: pickNumber(metadata, ["totalSeams", "total_seams", "seams"]),
    roll_length_fit: pickString(metadata, ["rollLengthFit", "roll_length_fit"]),
    compaction_method: pickString(metadata, ["compactionMethod", "compaction_method", "compactacionType"]),
    compaction_surface_firm: pickBoolean(metadata, ["surfaceFirm", "compaction_surface_firm"]),
    compaction_moisture_ok: pickBoolean(metadata, ["moistureOk", "compaction_moisture_ok"]),
    compaction_double: pickBoolean(metadata, ["doubleCompaction", "compaction_double"]),
    metadata: {
      module: row.module,
      fieldType: row.field_type ?? null,
      projectZoneId:
        row.project_zone_id ??
        pickString(payload, ["projectZoneId", "project_zone_id"]) ??
        pickString(metadata, ["projectZoneId", "project_zone_id"]),
      captureSessionId:
        row.capture_session_id ??
        pickString(payload, ["captureSessionId", "capture_session_id"]) ??
        pickString(metadata, ["captureSessionId", "capture_session_id"]),
      captureStatus:
        row.capture_status ??
        pickString(payload, ["captureStatus", "capture_status"]) ??
        "complete",
      macroZone: row.macro_zone ?? pickString(metadata, ["macroZone", "macro_zone"]),
      microZone: row.micro_zone ?? pickString(metadata, ["microZone", "micro_zone"]),
      internalPhase: internalPhase ?? null,
      payload: metadata,
    },
  }))
}

function buildRollInstallationCaptureRows(row) {
  const photos = Array.isArray(row.photos) ? row.photos : []
  return photos
    .map((item) => photoUrlFromPhotoObject(item))
    .filter(Boolean)
    .map((imageUrl) => ({
      project_id: row.project_id,
      phase: "roll_install",
      image_url: imageUrl,
      timestamp: toStringValue(row.created_at) ?? new Date().toISOString(),
      crew: null,
      zone: toStringValue(row.zone) ?? toStringValue(row.micro_zone) ?? toStringValue(row.macro_zone),
      notes: null,
      module: "roll-installation",
      field_type: toStringValue(row.field_type),
      project_zone_id: toStringValue(row.project_zone_id),
      capture_session_id: toStringValue(row.capture_session_id),
      capture_status: toStringValue(row.capture_status) ?? "complete",
      macro_zone: toStringValue(row.macro_zone),
      micro_zone: toStringValue(row.micro_zone),
      flow_step_key: null,
      condition_label: null,
      feet_installed: null,
      glue_buckets: null,
      total_rolls_used: toNumber(row.total_rolls_used),
      total_seams: toNumber(row.total_seams),
      roll_length_fit: toStringValue(row.roll_length_fit),
      compaction_method: toStringValue(row.compaction_method),
      compaction_surface_firm: toBoolean(row.compaction_surface_firm),
      compaction_moisture_ok: toBoolean(row.compaction_moisture_ok),
      compaction_double: toBoolean(row.compaction_double),
      metadata: {
        projectZoneId: row.project_zone_id ?? null,
        captureSessionId: row.capture_session_id ?? null,
        captureStatus: row.capture_status ?? "complete",
        fieldType: row.field_type ?? null,
        macroZone: row.macro_zone ?? null,
        microZone: row.micro_zone ?? null,
        zoneType: row.zone_type ?? null,
        rollLengthFit: row.roll_length_fit ?? null,
        totalRollsUsed: row.total_rolls_used ?? null,
        totalSeams: row.total_seams ?? null,
        compaction: {
          surfaceFirm: row.compaction_surface_firm ?? null,
          moistureOk: row.compaction_moisture_ok ?? null,
          doubleCompaction: row.compaction_double ?? null,
          method: row.compaction_method ?? null,
        },
      },
    }))
}

function buildMaterialCaptureRows(row) {
  const photos = Array.isArray(row.fotos) ? row.fotos : []
  return photos
    .map((item) => (typeof item === "string" && item.trim() ? item.trim() : null))
    .filter(Boolean)
    .map((imageUrl) => ({
      project_id: row.project_id,
      phase: "material",
      image_url: imageUrl,
      timestamp: toStringValue(row.created_at) ?? new Date().toISOString(),
      crew: null,
      zone: toStringValue(row.micro_zone) ?? toStringValue(row.macro_zone),
      notes: toStringValue(row.observaciones),
      module: "material",
      field_type: toStringValue(row.field_type),
      project_zone_id: toStringValue(row.project_zone_id),
      capture_session_id: toStringValue(row.capture_session_id),
      capture_status: toStringValue(row.capture_status) ?? "complete",
      macro_zone: toStringValue(row.macro_zone),
      micro_zone: toStringValue(row.micro_zone),
      flow_step_key: null,
      condition_label: null,
      feet_installed: null,
      glue_buckets: null,
      total_rolls_used: null,
      total_seams: null,
      roll_length_fit: null,
      compaction_method: null,
      compaction_surface_firm: null,
      compaction_moisture_ok: null,
      compaction_double: null,
      metadata: {
        projectZoneId: row.project_zone_id ?? null,
        captureSessionId: row.capture_session_id ?? null,
        captureStatus: row.capture_status ?? "complete",
        fieldType: row.field_type ?? null,
        tipoMaterial: row.tipo_material ?? null,
        tipoPasada: row.tipo_pasada ?? null,
        valvula: row.valvula ?? null,
        bolsasEsperadas: row.bolsas_esperadas ?? null,
        bolsasUtilizadas: row.bolsas_utilizadas ?? null,
        deviation: row.desviacion ?? null,
        statusColor: row.status_color ?? null,
      },
    }))
}

function buildFingerprint(row) {
  return [
    row.project_id ?? "",
    row.phase ?? "",
    row.capture_session_id ?? "",
    row.image_url ?? "",
  ].join("|")
}

function shouldUpdateCapture(existing, normalized) {
  const fields = [
    "module",
    "field_type",
    "project_zone_id",
    "capture_session_id",
    "capture_status",
    "macro_zone",
    "micro_zone",
    "flow_step_key",
    "condition_label",
    "feet_installed",
    "glue_buckets",
    "total_rolls_used",
    "total_seams",
    "roll_length_fit",
    "compaction_method",
    "compaction_surface_firm",
    "compaction_moisture_ok",
    "compaction_double",
  ]

  return fields.some((field) => {
    const left = existing[field] ?? null
    const right = normalized[field] ?? null
    return left !== right
  })
}

async function applyBatches(supabase, table, rows, mode) {
  for (const batch of chunk(rows, 200)) {
    const response =
      mode === "upsert"
        ? await supabase.from(table).upsert(batch, { onConflict: "id" })
        : await supabase.from(table).insert(batch)

    if (response.error) {
      throw new Error(`[${table}] ${response.error.message}`)
    }
  }
}

async function main() {
  initEnv()
  const apply = process.argv.includes("--apply")
  const supabase = getSupabaseClient()

  await assertCaptureSchemaReady(supabase)

  const captures = await fetchAllRows(
    supabase,
    "captures",
    "id,project_id,phase,image_url,metadata,module,field_type,project_zone_id,capture_session_id,capture_status,macro_zone,micro_zone,flow_step_key,condition_label,feet_installed,glue_buckets,total_rolls_used,total_seams,roll_length_fit,compaction_method,compaction_surface_firm,compaction_moisture_ok,compaction_double"
  )

  const existingFingerprints = new Set(captures.map((row) => buildFingerprint(row)))
  const captureUpdates = []

  for (const row of captures) {
    const normalized = buildNormalizedCaptureFromExisting(row)
    if (shouldUpdateCapture(row, normalized)) {
      captureUpdates.push(normalized)
    }
  }

  const fieldRecords = await fetchAllRowsWithFallbacks(supabase, "field_records", [
    "id,project_id,module,field_type,project_zone_id,capture_session_id,capture_status,macro_zone,micro_zone,payload,created_at",
    "id,project_id,module,field_type,project_zone_id,capture_session_id,capture_status,payload,created_at",
  ])
  const rollInstallation = await fetchAllRowsWithFallbacks(supabase, "roll_installation", [
    "id,project_id,project_zone_id,capture_session_id,capture_status,field_type,macro_zone,micro_zone,zone,zone_type,roll_length_fit,total_rolls_used,total_seams,compaction_surface_firm,compaction_moisture_ok,compaction_double,compaction_method,photos,created_at",
    "id,project_id,project_zone_id,capture_session_id,capture_status,zone,roll_length_fit,total_rolls_used,total_seams,compaction_surface_firm,compaction_moisture_ok,compaction_double,compaction_method,photos,created_at",
  ])
  const materialRecords = await fetchAllRowsWithFallbacks(supabase, "material_records", [
    "id,project_id,project_zone_id,capture_session_id,capture_status,field_type,macro_zone,micro_zone,tipo_material,tipo_pasada,valvula,bolsas_esperadas,bolsas_utilizadas,desviacion,status_color,observaciones,fotos,created_at",
    "id,project_id,project_zone_id,capture_session_id,capture_status,field_type,tipo_material,tipo_pasada,valvula,bolsas_esperadas,bolsas_utilizadas,desviacion,status_color,observaciones,fotos,created_at",
  ])

  const candidateRows = [
    ...fieldRecords.flatMap((row) => buildFieldRecordCaptureRows(row)),
    ...rollInstallation.flatMap((row) => buildRollInstallationCaptureRows(row)),
    ...materialRecords.flatMap((row) => buildMaterialCaptureRows(row)),
  ]

  const inserts = []
  for (const row of candidateRows) {
    const fingerprint = buildFingerprint(row)
    if (existingFingerprints.has(fingerprint)) continue
    existingFingerprints.add(fingerprint)
    inserts.push(row)
  }

  const summary = {
    dryRun: !apply,
    capturesExisting: captures.length,
    capturesToUpdate: captureUpdates.length,
    candidateHistoricalRows: candidateRows.length,
    capturesToInsert: inserts.length,
    fieldRecords: fieldRecords.length,
    rollInstallation: rollInstallation.length,
    materialRecords: materialRecords.length,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to execute the backfill.")
    return
  }

  if (captureUpdates.length > 0) {
    await applyBatches(supabase, "captures", captureUpdates, "upsert")
  }

  if (inserts.length > 0) {
    await applyBatches(supabase, "captures", inserts, "insert")
  }

  console.log("Backfill applied successfully.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
