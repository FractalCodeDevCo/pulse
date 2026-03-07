export type SiteType = "single" | "complex"

export type FieldUnit = {
  id: string
  label: string
}

export type FieldUnitsConfig = {
  siteType: SiteType
  units: FieldUnit[]
  updatedAt: string
}

const STORAGE_PREFIX = "pulse_field_units_v1"

function key(projectId: string): string {
  return `${STORAGE_PREFIX}_${projectId}`
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

function normalizeId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function defaultFieldUnitsConfig(): FieldUnitsConfig {
  return {
    siteType: "single",
    units: [{ id: "field-1", label: "Field 1" }],
    updatedAt: new Date().toISOString(),
  }
}

export function buildComplexUnits(count: number): FieldUnit[] {
  const safe = Math.max(1, Math.min(20, Math.floor(count || 1)))
  return Array.from({ length: safe }, (_, index) => ({
    id: `field-${index + 1}`,
    label: `Field ${index + 1}`,
  }))
}

export function readFieldUnitsConfig(projectId: string): FieldUnitsConfig {
  if (!projectId || !canUseStorage()) return defaultFieldUnitsConfig()
  try {
    const raw = localStorage.getItem(key(projectId))
    if (!raw) return defaultFieldUnitsConfig()
    const parsed = JSON.parse(raw) as Partial<FieldUnitsConfig>
    const siteType: SiteType = parsed.siteType === "complex" ? "complex" : "single"
    const units = Array.isArray(parsed.units)
      ? parsed.units
          .map((row) => {
            const item = row as Partial<FieldUnit>
            const label = typeof item.label === "string" && item.label.trim().length > 0 ? item.label.trim() : null
            if (!label) return null
            const idCandidate = typeof item.id === "string" && item.id.trim().length > 0 ? item.id : label
            return { id: normalizeId(idCandidate) || normalizeId(label), label }
          })
          .filter((row): row is FieldUnit => Boolean(row))
      : []
    if (units.length === 0) return defaultFieldUnitsConfig()
    return {
      siteType,
      units,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return defaultFieldUnitsConfig()
  }
}

export function saveFieldUnitsConfig(projectId: string, config: FieldUnitsConfig): void {
  if (!projectId || !canUseStorage()) return
  const normalizedUnits = config.units
    .map((row) => ({
      id: normalizeId(row.id || row.label),
      label: row.label.trim(),
    }))
    .filter((row) => row.id.length > 0 && row.label.length > 0)
  if (normalizedUnits.length === 0) return
  const payload: FieldUnitsConfig = {
    siteType: config.siteType,
    units: normalizedUnits,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(key(projectId), JSON.stringify(payload))
}
