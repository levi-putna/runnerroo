import { createClient } from "@/lib/supabase/server"

export interface UserFileRow {
  id: string
  created_at: string
  user_id: string
  bucket: string
  path: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  metadata: Record<string, unknown>
}

export interface WorkflowDocumentTemplateRow {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  workflow_id: string | null
  name: string
  bucket: string
  path: string
  mime_type: string | null
  size_bytes: number | null
  metadata: Record<string, unknown>
}

export interface FetchUserFilesForUserParams {
  category?: string
}

/**
 * Loads artefact records for the signed-in user from `user_files`.
 */
export async function fetchUserFilesForUser({
  category,
}: FetchUserFilesForUserParams = {}): Promise<UserFileRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from("user_files")
    .select("id, created_at, user_id, bucket, path, name, mime_type, size_bytes, metadata")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (category && category.trim().length > 0) {
    query = query.eq("metadata->>category", category.trim())
  }

  const { data, error } = await query
  if (error) {
    console.error("fetchUserFilesForUser", error.message)
    return []
  }
  return (data ?? []) as UserFileRow[]
}

/**
 * Loads template records for the signed-in user from `workflow_document_templates`.
 */
export async function fetchWorkflowDocumentTemplatesForUser(): Promise<WorkflowDocumentTemplateRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("workflow_document_templates")
    .select("id, created_at, updated_at, user_id, workflow_id, name, bucket, path, mime_type, size_bytes, metadata")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("fetchWorkflowDocumentTemplatesForUser", error.message)
    return []
  }
  return (data ?? []) as WorkflowDocumentTemplateRow[]
}
