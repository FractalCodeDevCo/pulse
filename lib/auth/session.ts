import { createClient } from "@supabase/supabase-js"

import { getSupabaseAdminClient } from "../supabase/server"

export type UserRole = "admin" | "pm" | "installer"

export type AuthContext = {
  userId: string
  email: string | null
  role: UserRole
  accessToken: string
}

export const PULSE_ACCESS_COOKIE = "pulse_access_token"
export const PULSE_REFRESH_COOKIE = "pulse_refresh_token"

const VALID_ROLES: UserRole[] = ["admin", "pm", "installer"]

type CookieMap = Record<string, string>

function getSupabasePublicClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are required for auth.")
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function parseCookieHeader(header: string | null): CookieMap {
  if (!header) return {}
  const pairs = header.split(";")
  const map: CookieMap = {}
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split("=")
    if (!rawKey) continue
    map[rawKey] = decodeURIComponent(rest.join("="))
  }
  return map
}

export function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim()
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"))
  const fromCookie = cookies[PULSE_ACCESS_COOKIE]
  return typeof fromCookie === "string" && fromCookie.length > 0 ? fromCookie : null
}

function isMissingRelationOrColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return (lower.includes("relation") || lower.includes("column")) && lower.includes("does not exist")
}

function parseAdminEmailsEnv(): string[] {
  const single = process.env.PULSE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const manyRaw = process.env.PULSE_BOOTSTRAP_ADMIN_EMAILS
  const many = typeof manyRaw === "string"
    ? manyRaw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    : []
  const all = [...many]
  if (single) all.push(single)
  return Array.from(new Set(all))
}

function shouldForceAdminByEmail(email: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  const adminEmails = parseAdminEmailsEnv()
  return adminEmails.includes(normalized)
}

export async function resolveOrProvisionUserRole(userId: string, email: string | null): Promise<UserRole | null> {
  const supabase = getSupabaseAdminClient()
  const forceAdminByEmail = shouldForceAdminByEmail(email)
  const allowSelfServeAdmin = process.env.PULSE_ALLOW_SELF_SERVE_ADMIN === "1"
  const shouldBeAdmin = forceAdminByEmail || allowSelfServeAdmin

  const roleRes = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (!roleRes.error && roleRes.data?.role && VALID_ROLES.includes(roleRes.data.role as UserRole)) {
    if (shouldBeAdmin && roleRes.data.role !== "admin") {
      const promote = await supabase.from("app_user_roles").upsert(
        {
          user_id: userId,
          role: "admin",
          assigned_by: null,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      if (!promote.error || isMissingRelationOrColumnError(promote.error.message)) {
        return "admin"
      }
    }
    return roleRes.data.role as UserRole
  }

  if (roleRes.error && isMissingRelationOrColumnError(roleRes.error.message)) {
    return shouldBeAdmin ? "admin" : "installer"
  }

  const roleToAssign: UserRole = shouldBeAdmin ? "admin" : "installer"
  const upsert = await supabase.from("app_user_roles").upsert(
    {
      user_id: userId,
      role: roleToAssign,
      assigned_by: null,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (upsert.error && !isMissingRelationOrColumnError(upsert.error.message)) {
    return null
  }

  return roleToAssign
}

export async function resolveAuthContext(request: Request): Promise<AuthContext | null> {
  const accessToken = getAccessTokenFromRequest(request)
  if (!accessToken) return null

  const supabase = getSupabasePublicClient()
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) return null

  const role = await resolveOrProvisionUserRole(data.user.id, data.user.email ?? null)
  if (!role) return null

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    role,
    accessToken,
  }
}

export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null
  if (!VALID_ROLES.includes(value as UserRole)) return null
  return value as UserRole
}

export function getSupabaseAuthClient() {
  return getSupabasePublicClient()
}
