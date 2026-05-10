import { fetchRecentConversationsForSidebar } from "@/lib/conversations/sidebar-recent-queries"
import { fetchRecentWorkflowsForSidebar, type WorkflowListRow } from "@/lib/workflows/queries/queries"

/**
 * Discriminant for items in the merged sidebar Recent list. Add new kinds when more
 * entity types appear here.
 */
export type SidebarRecentEntryKind = "conversation" | "workflow"

/**
 * One row in the app sidebar “Recent” section — conversations, workflows, or future types.
 */
export type SidebarRecentEntry =
  | {
      kind: "conversation"
      id: string
      label: string
      href: string
      recencyAt: string
    }
  | {
      kind: "workflow"
      id: string
      label: string
      href: string
      recencyAt: string
    }

/**
 * Human-readable title for a conversation row in the sidebar.
 */
function conversationLabel({ title }: { title: string | null }): string {
  const t = title?.trim()
  return t && t.length > 0 ? t : "Untitled conversation"
}

/**
 * ISO timestamp of the latest create-or-update activity on a workflow.
 */
function workflowRecencyIso({ workflow }: { workflow: WorkflowListRow }): string {
  const t = Math.max(new Date(workflow.updated_at).getTime(), new Date(workflow.created_at).getTime())
  return new Date(t).toISOString()
}

/**
 * Loads capped recent conversations and workflows (same rolling window and per-type caps),
 * merged and sorted by {@link SidebarRecentEntry.recencyAt} descending.
 */
export async function fetchSidebarRecentEntries(): Promise<SidebarRecentEntry[]> {
  const [conversations, workflows] = await Promise.all([
    fetchRecentConversationsForSidebar(),
    fetchRecentWorkflowsForSidebar(),
  ])

  const entries: SidebarRecentEntry[] = [
    ...conversations.map((c) => ({
      kind: "conversation" as const,
      id: c.id,
      label: conversationLabel({ title: c.title }),
      href: `/app/chat/${c.id}`,
      recencyAt: c.updated_at,
    })),
    ...workflows.map((w) => ({
      kind: "workflow" as const,
      id: w.id,
      label: w.name,
      href: `/app/workflows/${w.id}`,
      recencyAt: workflowRecencyIso({ workflow: w }),
    })),
  ]

  entries.sort((a, b) => new Date(b.recencyAt).getTime() - new Date(a.recencyAt).getTime())
  return entries
}
