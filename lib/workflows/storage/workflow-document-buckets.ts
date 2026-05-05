/** Supabase bucket for workflow `.doc`/`.docx` templates only (never mixed with generated outputs). */
export const WORKFLOW_DOCUMENT_TEMPLATES_BUCKET = "workflow-document-templates"

/** Bucket for rendered document outputs created at run time. */
export const WORKFLOW_DOCUMENT_OUTPUTS_BUCKET = "workflow-document-outputs"

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const
const DOC_LEGACY = "application/msword" as const

/** MIME types permitted for uploads into {@link WORKFLOW_DOCUMENT_TEMPLATES_BUCKET}. */
export const WORKFLOW_DOCUMENT_TEMPLATE_MIME_TYPES: readonly string[] = [DOCX, DOC_LEGACY]
