import { fetchWorkflowsForUser } from "@/lib/workflows/queries/queries"
import { WorkflowsIndex } from "./workflows-index"

/**
 * Workflow library for the signed-in user: overview tiles (below title), bordered detail table, and footer counts —
 * same top alignment and padded body pattern as Usage and other settings pages (no outer page padding).
 */
export default async function WorkflowsPage() {
  const workflows = await fetchWorkflowsForUser()
  return <WorkflowsIndex workflows={workflows} className="w-full" />
}
