import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "../../../../lib/supabase/server"
import { getSupabaseAuthClient, normalizeRole, PULSE_ACCESS_COOKIE, PULSE_REFRESH_COOKIE } from "../../../../lib/auth/session"

export const runtime = "nodejs"

type LoginBody = {
  email?: string
  password?: string
}

function cookieBaseOptions() {
  const isProd = process.env.NODE_ENV === "production"
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody
    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ""

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    const auth = getSupabaseAuthClient()
    const { data, error } = await auth.auth.signInWithPassword({ email, password })
    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Invalid credentials." }, { status: 401 })
    }

    const admin = getSupabaseAdminClient()
    const roleRes = await admin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle()

    const role = normalizeRole(roleRes.data?.role) ?? (process.env.PULSE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() === email ? "admin" : null)
    if (!role) {
      return NextResponse.json({ error: "Your user has no assigned role yet." }, { status: 403 })
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        role,
      },
    })

    response.cookies.set(PULSE_ACCESS_COOKIE, data.session.access_token, {
      ...cookieBaseOptions(),
      maxAge: 60 * 60 * 12,
    })
    response.cookies.set(PULSE_REFRESH_COOKIE, data.session.refresh_token, {
      ...cookieBaseOptions(),
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
