import { NextResponse } from "next/server"

import { requireAuth } from "../../../../../lib/auth/guard"
import { normalizeRole } from "../../../../../lib/auth/session"
import { getSupabaseAdminClient } from "../../../../../lib/supabase/server"

export const runtime = "nodejs"

type RoleBody = {
  userId?: string
  role?: string
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin"])
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as RoleBody
    const userId = body.userId?.trim()
    const role = normalizeRole(body.role)

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and valid role are required." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.from("app_user_roles").upsert(
      {
        user_id: userId,
        role,
        assigned_by: auth.context.userId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, userId, role })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
