import { NextResponse } from "next/server"

import { PULSE_ACCESS_COOKIE, PULSE_REFRESH_COOKIE } from "../../../../lib/auth/session"

export const runtime = "nodejs"

function cookieBaseOptions() {
  const isProd = process.env.NODE_ENV === "production"
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  }
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(PULSE_ACCESS_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 })
  response.cookies.set(PULSE_REFRESH_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 })
  return response
}
