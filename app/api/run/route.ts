import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchRecentWorkflowRunsForUser } from "@/lib/workflows/queries/run-queries"

/**
 * Lists recent workflow runs for the signed-in user (newest first).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limitRaw = url.searchParams.get("limit")
  const limit = Math.min(200, Math.max(1, Number(limitRaw) || 100))

  const runs = await fetchRecentWorkflowRunsForUser({ limit })
  return NextResponse.json({ runs })
}
