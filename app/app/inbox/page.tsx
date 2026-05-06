import { fetchPendingWorkflowApprovalsForUser } from "@/lib/workflows/queries/approval-queries"
import { InboxClient } from "./inbox-client"

/**
 * Workflow approval inbox — human-in-the-loop checkpoints shown as pending items until actioned.
 */
export default async function InboxPage() {
  const initialApprovals = await fetchPendingWorkflowApprovalsForUser()

  return <InboxClient initialApprovals={initialApprovals} className="w-full" />
}
