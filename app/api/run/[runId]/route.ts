import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchWorkflowRunByIdForUser } from "@/lib/workflows/queries/run-queries"

/**
 * Returns a single persisted workflow run visible to the signed-in user.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const run = await fetchWorkflowRunByIdForUser({ runId })
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ run })
}
