import { NextResponse } from "next/server"

import { requireAuth } from "../../../../lib/auth/guard"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    user: {
      id: auth.context.userId,
      email: auth.context.email,
      role: auth.context.role,
    },
  })
}
