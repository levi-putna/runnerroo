import { notFound } from "next/navigation"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { WorkflowSettingsClient } from "./workflow-settings-client"
import { normaliseWorkflowConstantsJson } from "@/lib/workflows/workflow-constants"

/**
 * SSR shell for per-workflow settings (constants, future options).
 */
export default async function WorkflowSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (id === "new") {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <p>Please sign in to edit workflow settings.</p>
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </div>
    )
  }

  const { data: workflow, error } = await supabase
    .from("workflows")
    .select("id, name, workflow_constants")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !workflow) {
    notFound()
  }

  const initialConstants = normaliseWorkflowConstantsJson(workflow.workflow_constants)

  return (
    <WorkflowSettingsClient
      workflowId={workflow.id}
      workflowName={workflow.name ?? "Untitled workflow"}
      initialConstants={initialConstants}
    />
  )
}
