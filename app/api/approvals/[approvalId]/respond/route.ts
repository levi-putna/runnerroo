import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resumeWorkflowGraphRunFast } from "@/lib/workflows/persist-workflow-graph-run"

type RespondBody = {
  decision?: "approved" | "declined"
}

/**
 * Applies an inbox decision and resumes or terminates the paused workflow run.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  let body: RespondBody = {}
  try {
    body = (await request.json()) as RespondBody
  } catch {
    body = {}
  }

  const decision = body.decision
  if (decision !== "approved" && decision !== "declined") {
    return NextResponse.json({ error: "Missing or invalid decision" }, { status: 400 })
  }

  try {
    const result = await resumeWorkflowGraphRunFast({
      supabase,
      approvalId,
      userId: user.id,
      decision,
    })

    return NextResponse.json({
      runId: result.runId,
      status: result.status,
      error: result.error,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not resume workflow."
    const status =
      msg === "Approval not found."
        ? 404
        : msg === "This approval has already been processed."
          ? 409
          : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
