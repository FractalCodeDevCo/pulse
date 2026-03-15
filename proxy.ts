import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PREFIXES = ["/projects", "/capture"]
const PULSE_ACCESS_COOKIE = "pulse_access_token"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!needsAuth) return NextResponse.next()

  const token = request.cookies.get(PULSE_ACCESS_COOKIE)?.value
  if (token) return NextResponse.next()

  const loginUrl = new URL("/pulse-access", request.url)
  loginUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/projects/:path*", "/capture/:path*"],
}
