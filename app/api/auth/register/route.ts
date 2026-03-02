import { NextResponse } from "next/server"

import { getSupabaseAuthClient, PULSE_ACCESS_COOKIE, PULSE_REFRESH_COOKIE, resolveOrProvisionUserRole } from "../../../../lib/auth/session"

export const runtime = "nodejs"

type RegisterBody = {
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
    const body = (await request.json()) as RegisterBody
    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ""

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "Email and password (>= 6 chars) are required." }, { status: 400 })
    }

    const auth = getSupabaseAuthClient()
    const { data, error } = await auth.auth.signUp({ email, password })
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Register failed." }, { status: 400 })
    }

    const role = await resolveOrProvisionUserRole(data.user.id, data.user.email ?? email)
    if (!role) {
      return NextResponse.json({ error: "User created but role provisioning failed." }, { status: 500 })
    }

    const response = NextResponse.json({
      ok: true,
      requiresEmailConfirmation: !data.session,
      user: { id: data.user.id, email: data.user.email ?? email, role },
    })

    if (data.session) {
      response.cookies.set(PULSE_ACCESS_COOKIE, data.session.access_token, {
        ...cookieBaseOptions(),
        maxAge: 60 * 60 * 12,
      })
      response.cookies.set(PULSE_REFRESH_COOKIE, data.session.refresh_token, {
        ...cookieBaseOptions(),
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
