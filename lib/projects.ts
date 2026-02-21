import { FieldType } from "../types/fieldType"
import { ZONE_HIERARCHY_BY_SPORT } from "../types/zoneHierarchy"

export type ZoneType = "PRECISION" | "STANDARD" | "PERIMETER" | "MARKINGS"
export type ZoneStepKey =
  | "COMPACT"
  | "ROLL_PLACEMENT"
  | "SEWING"
  | "CUT"
  | "ADHESIVE"

export type ZoneStepTemplate = {
  key: ZoneStepKey
  label: string
}

export type ProjectZone = {
  id: string
  projectId: string
  fieldType: FieldType
  macroZone: string
  microZone: string
  zoneType: ZoneType
  stepKeys: ZoneStepKey[]
  completedStepKeys: ZoneStepKey[]
}

export type AppProject = {
  id: string
  name: string
  fieldType: FieldType
  createdAt: string
}

export const PROJECTS_STORAGE_KEY = "pulse_projects_v2"
export const LEGACY_PROJECTS_STORAGE_KEY = "pulse_projects"
export const PROJECT_ZONES_STORAGE_KEY = "pulse_project_zones_v2"
export const LAST_PROJECT_STORAGE_KEY = "pulse_last_project"

export const MOCK_PROJECTS: AppProject[] = [
  { id: "obra-norte", name: "Obra Norte", fieldType: "beisbol", createdAt: new Date().toISOString() },
  { id: "obra-sur", name: "Obra Sur", fieldType: "soccer", createdAt: new Date().toISOString() },
  { id: "stadium-east", name: "Stadium East", fieldType: "football", createdAt: new Date().toISOString() },
]

const STEP_TEMPLATES_BY_ZONE_TYPE: Record<ZoneType, ZoneStepTemplate[]> = {
  PRECISION: [
    { key: "COMPACT", label: "Compaction" },
    { key: "ROLL_PLACEMENT", label: "Roll Placement" },
    { key: "SEWING", label: "Sewing" },
    { key: "CUT", label: "Cut" },
    { key: "ADHESIVE", label: "Adhesive" },
  ],
  STANDARD: [
    { key: "COMPACT", label: "Compaction" },
    { key: "ROLL_PLACEMENT", label: "Roll Placement" },
    { key: "SEWING", label: "Sewing" },
    { key: "ADHESIVE", label: "Adhesive" },
  ],
  PERIMETER: [
    { key: "COMPACT", label: "Compaction" },
    { key: "ROLL_PLACEMENT", label: "Roll Placement" },
    { key: "CUT", label: "Cut" },
    { key: "ADHESIVE", label: "Adhesive" },
  ],
  MARKINGS: [
    { key: "COMPACT", label: "Compaction" },
    { key: "ROLL_PLACEMENT", label: "Roll Placement" },
    { key: "CUT", label: "Cut" },
    { key: "ADHESIVE", label: "Adhesive" },
  ],
}

function canUseStorage() {
  return typeof window !== "undefined"
}

function normalizeFieldType(value: unknown): FieldType {
  return value === "football" || value === "soccer" || value === "beisbol" || value === "softbol"
    ? value
    : "football"
}

function normalizeProject(input: Partial<AppProject>): AppProject {
  return {
    id: String(input.id ?? ""),
    name: String(input.name ?? input.id ?? ""),
    fieldType: normalizeFieldType(input.fieldType),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
  }
}

function readRawProjects(): unknown[] {
  if (!canUseStorage()) return MOCK_PROJECTS

  try {
    const v2 = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (v2) {
      const parsed = JSON.parse(v2) as unknown[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fallback
  }

  try {
    const legacy = localStorage.getItem(LEGACY_PROJECTS_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fallback
  }

  return MOCK_PROJECTS
}

function readZonesMap(): Record<string, ProjectZone[]> {
  if (!canUseStorage()) return {}

  try {
    const raw = localStorage.getItem(PROJECT_ZONES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ProjectZone[]>
    if (parsed && typeof parsed === "object") return parsed
  } catch {
    // fallback
  }

  return {}
}

function saveZonesMap(map: Record<string, ProjectZone[]>) {
  if (!canUseStorage()) return
  localStorage.setItem(PROJECT_ZONES_STORAGE_KEY, JSON.stringify(map))
}

function inferZoneType(macroZone: string, microZone: string): ZoneType {
  const macro = macroZone.toLowerCase()
  const micro = microZone.toLowerCase()

  if (macro.includes("warning") || macro.includes("sideline") || macro.includes("foul")) return "PERIMETER"
  if (macro.includes("logo") || micro.includes("logo") || micro.includes("mark")) {
    return "MARKINGS"
  }
  if (
    macro.includes("infield") ||
    macro.includes("endzone") ||
    micro.includes("box") ||
    micro.includes("mound") ||
    micro.includes("plate")
  ) {
    return "PRECISION"
  }

  return "STANDARD"
}

function buildProjectZoneId(projectId: string, macroZone: string, microZone: string, index: number) {
  return `${projectId}__${slugifyProjectName(`${macroZone}-${microZone}-${index + 1}`)}`
}

function buildZoneTemplateKey(zone: Pick<ProjectZone, "macroZone" | "microZone">): string {
  return `${zone.macroZone}::${zone.microZone}`
}

function areZoneTemplatesAligned(existing: ProjectZone[], generated: ProjectZone[]): boolean {
  if (existing.length !== generated.length) return false

  const existingKeys = existing.map(buildZoneTemplateKey).sort()
  const generatedKeys = generated.map(buildZoneTemplateKey).sort()
  return existingKeys.every((value, index) => value === generatedKeys[index])
}

export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function readProjectsFromStorage(): AppProject[] {
  const normalized = readRawProjects().map((item) => normalizeProject(item as Partial<AppProject>))
  return normalized.length > 0 ? normalized : MOCK_PROJECTS
}

export function saveProjects(projects: AppProject[]) {
  if (!canUseStorage()) return
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
}

export function readLastProjectId(defaultId: string): string {
  if (!canUseStorage()) return defaultId
  try {
    const raw = localStorage.getItem(LAST_PROJECT_STORAGE_KEY)
    if (!raw) return defaultId
    const parsed = JSON.parse(raw) as string
    return parsed || defaultId
  } catch {
    return defaultId
  }
}

export function saveLastProject(projectId: string) {
  if (!canUseStorage()) return
  localStorage.setItem(LAST_PROJECT_STORAGE_KEY, JSON.stringify(projectId))
}

export function createProject(input: { id: string; name: string; fieldType: FieldType }): AppProject {
  return {
    id: input.id,
    name: input.name,
    fieldType: input.fieldType,
    createdAt: new Date().toISOString(),
  }
}

export function getProjectById(projectId: string): AppProject | null {
  const project = readProjectsFromStorage().find((item) => item.id === projectId)
  return project ?? null
}

export function generateProjectZones(projectId: string, fieldType: FieldType): ProjectZone[] {
  const macros = ZONE_HIERARCHY_BY_SPORT[fieldType]
  const zones: ProjectZone[] = []

  Object.entries(macros).forEach(([macroZone, microZones]) => {
    microZones.forEach((microZone, index) => {
      const zoneType = inferZoneType(macroZone, microZone)
      zones.push({
        id: buildProjectZoneId(projectId, macroZone, microZone, index),
        projectId,
        fieldType,
        macroZone,
        microZone,
        zoneType,
        stepKeys: STEP_TEMPLATES_BY_ZONE_TYPE[zoneType].map((step) => step.key),
        completedStepKeys: [],
      })
    })
  })

  return zones
}

export function ensureProjectZones(projectId: string, fieldType: FieldType): ProjectZone[] {
  const zonesMap = readZonesMap()
  const existing = zonesMap[projectId]
  const generated = generateProjectZones(projectId, fieldType)

  if (Array.isArray(existing) && existing.length > 0) {
    if (areZoneTemplatesAligned(existing, generated)) return existing

    const existingByTemplate = new Map(existing.map((zone) => [buildZoneTemplateKey(zone), zone]))
    const migrated = generated.map((zone) => {
      const previous = existingByTemplate.get(buildZoneTemplateKey(zone))
      if (!previous) return zone

      return {
        ...zone,
        completedStepKeys: previous.completedStepKeys.filter((key) => zone.stepKeys.includes(key)),
      }
    })

    zonesMap[projectId] = migrated
    saveZonesMap(zonesMap)
    return migrated
  }

  zonesMap[projectId] = generated
  saveZonesMap(zonesMap)
  return generated
}

export function readProjectZones(projectId: string): ProjectZone[] {
  const zonesMap = readZonesMap()
  return zonesMap[projectId] ?? []
}

export function getProjectZoneById(projectId: string, projectZoneId: string): ProjectZone | null {
  return readProjectZones(projectId).find((zone) => zone.id === projectZoneId) ?? null
}

export function toggleProjectZoneStep(projectId: string, projectZoneId: string, stepKey: ZoneStepKey): ProjectZone | null {
  const zonesMap = readZonesMap()
  const zones = zonesMap[projectId] ?? []
  const index = zones.findIndex((zone) => zone.id === projectZoneId)
  if (index < 0) return null

  const zone = zones[index]
  const hasStep = zone.completedStepKeys.includes(stepKey)
  const completedStepKeys = hasStep
    ? zone.completedStepKeys.filter((key) => key !== stepKey)
    : [...zone.completedStepKeys, stepKey]

  const nextZone: ProjectZone = { ...zone, completedStepKeys }
  zones[index] = nextZone
  zonesMap[projectId] = zones
  saveZonesMap(zonesMap)
  return nextZone
}

export function getZoneStepTemplates(zoneType: ZoneType): ZoneStepTemplate[] {
  return STEP_TEMPLATES_BY_ZONE_TYPE[zoneType]
}

export function getZoneProgress(zone: ProjectZone): number {
  if (zone.stepKeys.length === 0) return 0
  return Math.round((zone.completedStepKeys.length / zone.stepKeys.length) * 100)
}
