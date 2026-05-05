import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkflowEditorClient } from "./editor-client"
import type { Database } from "@/types/database"

type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"]

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (id === "new") {
    return <WorkflowEditorClient workflowId={id} initialWorkflow={null} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: row } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!row) notFound()

  return <WorkflowEditorClient workflowId={id} initialWorkflow={row as WorkflowRow} />
}
