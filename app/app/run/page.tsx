import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { fetchWorkflowsForUser } from "@/lib/workflows/queries/queries"
import { fetchRecentWorkflowRunsForUser } from "@/lib/workflows/queries/run-queries"
import { WorkflowRunHubClient } from "./run-hub-client"

/**
 * Authenticated hub: recent workflow runs with filters and overview tiles aligned with Workflows / Usage.
 */
export default async function RunsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ workflow?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <p>Please sign in to view saved runs.</p>
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </div>
    )
  }

  const sp = await searchParams
  const rawWorkflow = sp.workflow
  const workflowFromQuery = Array.isArray(rawWorkflow) ? rawWorkflow[0] : rawWorkflow

  const [runs, workflows] = await Promise.all([
    fetchRecentWorkflowRunsForUser({ limit: 100 }),
    fetchWorkflowsForUser(),
  ])

  const workflowIds = new Set(workflows.map((w) => w.id))
  const initialWorkflowId =
    workflowFromQuery != null && workflowFromQuery.length > 0 && workflowIds.has(workflowFromQuery)
      ? workflowFromQuery
      : null

  return (
    <WorkflowRunHubClient
      key={initialWorkflowId ?? "__all__"}
      runs={runs}
      workflows={workflows.map(({ id, name }) => ({ id, name }))}
      initialWorkflowId={initialWorkflowId}
      className="w-full"
    />
  )
}
