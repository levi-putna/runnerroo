import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { WorkflowRunHistoryClient } from "./history-client"

/**
 * SSR page: lists recent executions for one workflow belonging to the session user.
 */
export default async function WorkflowRunHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (id === "new") {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <p>Please sign in to view workflow history.</p>
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </div>
    )
  }

  const { data: workflow, error: wfErr } = await supabase
    .from("workflows")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (wfErr || !workflow) notFound()

  const { data: runs, error: runsErr } = await supabase
    .from("workflow_runs")
    .select(
      "id, workflow_id, status, started_at, completed_at, duration_ms, trigger_type, error, node_results, wdk_run_id, trigger_inputs",
    )
    .eq("workflow_id", id)
    .order("started_at", { ascending: false })
    .limit(100)

  if (runsErr) {
    return (
      <div className="p-6 text-sm text-destructive">
        Could not load runs: {runsErr.message}
      </div>
    )
  }

  return (
    <WorkflowRunHistoryClient
      workflowId={workflow.id}
      workflowName={workflow.name ?? "Untitled workflow"}
      runs={runs ?? []}
    />
  )
}
