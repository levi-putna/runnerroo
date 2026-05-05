import { fetchWorkflowsForUser } from "@/lib/workflows/queries/queries"
import { WorkflowsIndex } from "./workflows-index"

export default async function WorkflowsPage() {
  const workflows = await fetchWorkflowsForUser()
  return <WorkflowsIndex workflows={workflows} />
}
