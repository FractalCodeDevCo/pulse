export type AppProject = {
  id: string
  name: string
}

export const MOCK_PROJECTS: AppProject[] = [
  { id: "obra-norte", name: "Obra Norte" },
  { id: "obra-sur", name: "Obra Sur" },
  { id: "stadium-east", name: "Stadium East" },
]

export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}
