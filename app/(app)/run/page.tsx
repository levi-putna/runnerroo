import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { fetchRecentWorkflowRunsForUser } from "@/lib/workflows/run-queries"
import { WorkflowRunHubClient } from "./run-hub-client"

/**
 * Authenticated hub: lists recent workflow runs persisted in Supabase across the user’s graphs.
 */
export default async function RunsHubPage() {
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

  const runs = await fetchRecentWorkflowRunsForUser({ limit: 100 })

  return <WorkflowRunHubClient runs={runs} />
}
