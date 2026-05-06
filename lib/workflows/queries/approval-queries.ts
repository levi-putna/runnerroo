import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type WorkflowApprovalListRow =
  Database["public"]["Tables"]["workflow_approvals"]["Row"] & {
    workflows: Pick<Database["public"]["Tables"]["workflows"]["Row"], "name"> | null
  }

/**
 * Lists pending approvals for inbox with workflow name hint.
 */
export async function fetchPendingWorkflowApprovalsForUser(): Promise<WorkflowApprovalListRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("workflow_approvals")
    .select("*, workflows(name)")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchPendingWorkflowApprovalsForUser", error.message)
    return []
  }
  return (data ?? []) as WorkflowApprovalListRow[]
}

/**
 * Count of approvals awaiting action — used for nav badge counts.
 */
export async function countPendingWorkflowApprovalsForUser(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from("workflow_approvals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")

  if (error) {
    console.error("countPendingWorkflowApprovalsForUser", error.message)
    return 0
  }
  return count ?? 0
}
