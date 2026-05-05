import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { fetchWorkflowRunByIdForUser } from "@/lib/workflows/queries/run-queries"
import { WorkflowRunDetailClient } from "./run-detail-client"

/**
 * Loads one saved run by id for the signed-in owner (via RLS + explicit workflow join).
 */
export default async function WorkflowRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <p>Please sign in to view this run.</p>
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </div>
    )
  }

  const run = await fetchWorkflowRunByIdForUser({ runId })
  if (!run) notFound()

  return <WorkflowRunDetailClient run={run} />
}
