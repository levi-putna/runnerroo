import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type WorkflowRunRow = Database["public"]["Tables"]["workflow_runs"]["Row"]

const runListSelect =
  "id, workflow_id, status, started_at, completed_at, duration_ms, trigger_type, error, node_results, wdk_run_id, trigger_inputs, workflows(name)" as const

export type WorkflowRunListItem = WorkflowRunRow & {
  workflows: { name: string } | null
}

export type WorkflowRunDetail = WorkflowRunRow & {
  workflows: { id: string; name: string } | null
}

/**
 * Recent runs across all workflows for the signed-in user (RLS-scoped).
 */
export async function fetchRecentWorkflowRunsForUser(p: { limit?: number } = {}): Promise<
  WorkflowRunListItem[]
> {
  const limit = p.limit ?? 100
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("workflow_runs")
    .select(runListSelect)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("fetchRecentWorkflowRunsForUser", error.message)
    return []
  }
  return (data ?? []) as unknown as WorkflowRunListItem[]
}

/**
 * Loads one run with parent workflow metadata if the row is visible to the current user.
 */
export async function fetchWorkflowRunByIdForUser(p: {
  runId: string
}): Promise<WorkflowRunDetail | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("workflow_runs")
    .select(
      "id, workflow_id, status, started_at, completed_at, duration_ms, trigger_type, error, node_results, wdk_run_id, trigger_inputs, workflows(id, name)",
    )
    .eq("id", p.runId)
    .maybeSingle()

  if (error) {
    console.error("fetchWorkflowRunByIdForUser", error.message)
    return null
  }
  if (!data) return null
  return data as unknown as WorkflowRunDetail
}
