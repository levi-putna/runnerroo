import { ArtifactsIndex } from "@/app/app/artifacts/artifacts-index"
import {
  fetchUserFilesForUser,
  fetchWorkflowDocumentTemplatesForUser,
  type UserFileRow,
} from "@/lib/artifacts/queries"

export interface ArtifactListItem extends UserFileRow {
  category: string
}

/**
 * Artefacts index page for browsing user-owned stored files.
 */
export default async function ArtifactsPage() {
  const [userFiles, templateFiles] = await Promise.all([
    fetchUserFilesForUser(),
    fetchWorkflowDocumentTemplatesForUser(),
  ])

  const mappedUserFiles: ArtifactListItem[] = userFiles.map((row) => ({
    ...row,
    category:
      typeof row.metadata?.category === "string" && row.metadata.category.length > 0
        ? row.metadata.category
        : "other",
  }))

  const templateFileRowsFromTemplates: ArtifactListItem[] = templateFiles
    .filter((row) => !mappedUserFiles.some((file) => file.bucket === row.bucket && file.path === row.path))
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user_id: row.user_id,
      bucket: row.bucket,
      path: row.path,
      name: row.name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      metadata: {
        ...row.metadata,
        workflow_id: row.workflow_id,
        category: "document_template",
      },
      category: "document_template",
    }))

  const artifacts = [...mappedUserFiles, ...templateFileRowsFromTemplates]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return <ArtifactsIndex artifacts={artifacts} />
}
