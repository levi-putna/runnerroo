import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Lists pending approvals for Inbox surfaces (authenticated owner).
 * Optional `workflow_run_id` query limits results to that run (e.g. run detail while awaiting approval).
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
  const workflowRunId = url.searchParams.get("workflow_run_id")?.trim() ?? null

  let query = supabase
    .from("workflow_approvals")
    .select("*, workflows(name)")
    .eq("user_id", user.id)
    .eq("status", "pending")

  if (workflowRunId) {
    query = query.eq("workflow_run_id", workflowRunId)
  }

  const { data: approvals, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    approvals: approvals ?? [],
  })
}
