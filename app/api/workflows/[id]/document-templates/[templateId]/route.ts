import { createClient } from "@/lib/supabase/server"

interface TemplateRecord {
  id: string
  user_id: string
  workflow_id: string | null
  bucket: string
  path: string
}

/**
 * Deletes a stored workflow template row and backing object path (authenticated owner only).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  const { id: workflowId, templateId } = await params

  if (!templateId.trim()) {
    return Response.json({ error: "templateId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 })
  }

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id,user_id")
    .eq("id", workflowId)
    .maybeSingle<{ id: string; user_id: string }>()

  if (workflowError) {
    return Response.json({ error: workflowError.message }, { status: 500 })
  }

  if (!workflow || workflow.user_id !== user.id) {
    return Response.json({ error: "Workflow not found" }, { status: 404 })
  }

  const { data: template, error: templateErr } = await supabase
    .from("workflow_document_templates")
    .select("id,user_id,workflow_id,bucket,path")
    .eq("id", templateId)
    .maybeSingle<TemplateRecord>()

  if (templateErr) {
    return Response.json({ error: templateErr.message }, { status: 500 })
  }

  if (!template || template.user_id !== user.id || template.workflow_id !== workflowId) {
    return Response.json({ error: "Template not found" }, { status: 404 })
  }

  const { error: removeErr } = await supabase.storage.from(template.bucket).remove([template.path])
  if (removeErr) {
    return Response.json({ error: removeErr.message }, { status: 500 })
  }

  const { error: deleteErr } = await supabase.from("workflow_document_templates").delete().eq("id", templateId)

  if (deleteErr) {
    return Response.json({ error: deleteErr.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
