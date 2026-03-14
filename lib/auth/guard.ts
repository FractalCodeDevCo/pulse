import { NextResponse } from "next/server"

import { resolveAuthContext, type UserRole } from "./session"

type GuardResult =
  | { ok: true; context: { userId: string; email: string | null; role: UserRole; accessToken: string } }
  | { ok: false; response: NextResponse }

export async function requireAuth(request: Request, allowedRoles?: UserRole[]): Promise<GuardResult> {
  const context = await resolveAuthContext(request)
  if (!context) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (allowedRoles && !allowedRoles.includes(context.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, context }
}
