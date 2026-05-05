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
