import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type WorkflowListRow = Pick<
  Database["public"]["Tables"]["workflows"]["Row"],
  | "id"
  | "name"
  | "description"
  | "trigger_type"
  | "trigger_config"
  | "status"
  | "run_count"
  | "last_run_at"
  | "updated_at"
  | "created_at"
>

const listSelect =
  "id, name, description, trigger_type, trigger_config, status, run_count, last_run_at, updated_at, created_at" as const

/**
 * Loads workflows for the signed-in user, newest first.
 */
export async function fetchWorkflowsForUser(p: { limit?: number } = {}): Promise<WorkflowListRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from("workflows")
    .select(listSelect)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (p.limit != null) {
    query = query.limit(p.limit)
  }

  const { data, error } = await query
  if (error) {
    console.error("fetchWorkflowsForUser", error.message)
    return []
  }
  return (data ?? []) as WorkflowListRow[]
}

/** Rolling window for sidebar “Recent” workflows (days), matching conversations. */
const RECENT_WORKFLOW_SIDEBAR_DAYS = 3

/** Maximum workflows merged into the sidebar Recent list after the window filter. */
const RECENT_WORKFLOWS_SIDEBAR_LIMIT = 6

/**
 * Reads workflows touched (created or updated) within the rolling window, newest by
 * that activity first, capped for the app sidebar. Uses an over-fetch then in-memory
 * sort by {@link workflowSidebarRecencyMs} so ordering matches “last activity”.
 */
export async function fetchRecentWorkflowsForSidebar(): Promise<WorkflowListRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_WORKFLOW_SIDEBAR_DAYS)
  const cutoffIso = cutoff.toISOString()
  const orClause = `updated_at.gte."${cutoffIso}",created_at.gte."${cutoffIso}"`

  const { data, error } = await supabase
    .from("workflows")
    .select(listSelect)
    .eq("user_id", user.id)
    .or(orClause)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("fetchRecentWorkflowsForSidebar", error.message)
    return []
  }

  const rows = (data ?? []) as WorkflowListRow[]
  rows.sort(
    (a, b) => workflowSidebarRecencyMs({ workflow: b }) - workflowSidebarRecencyMs({ workflow: a })
  )
  return rows.slice(0, RECENT_WORKFLOWS_SIDEBAR_LIMIT)
}

/**
 * Latest activity timestamp for a workflow row (created or updated), in milliseconds.
 */
function workflowSidebarRecencyMs({ workflow }: { workflow: WorkflowListRow }): number {
  return Math.max(new Date(workflow.updated_at).getTime(), new Date(workflow.created_at).getTime())
}

