import { createClient } from "@/lib/supabase/server"
import {
  WORKFLOW_DOCUMENT_TEMPLATE_MIME_TYPES,
  WORKFLOW_DOCUMENT_TEMPLATES_BUCKET,
} from "@/lib/workflows/storage/workflow-document-buckets"

const MAX_BYTES = 50 * 1024 * 1024

interface PostDocumentTemplateParseResult {
  nodeId?: string | null
  file?: File | null
  error?: string
}

async function parsePostBody({ request }: { request: Request }): Promise<PostDocumentTemplateParseResult> {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return { error: 'Expected multipart/form-data body with fields "nodeId" and "file".' }
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return { error: "Could not read upload body." }
  }

  const nodeIdRaw = formData.get("nodeId")
  const nodeId = typeof nodeIdRaw === "string" ? nodeIdRaw.trim() : ""
  const file = formData.get("file")

  if (!nodeId) {
    return { error: "nodeId is required." }
  }
  if (!(file instanceof File)) {
    return { error: "file is required." }
  }

  return { nodeId, file }
}

function templateFileStem({ name }: { name: string }): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "template"
  const sanitized = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "")
  const stem = sanitized.length > 0 ? sanitized.slice(0, 180) : "template"
  return stem
}

function resolveTemplateMimeType({ file }: { file: File }): string | null {
  const type = file.type?.trim()
  if (type && WORKFLOW_DOCUMENT_TEMPLATE_MIME_TYPES.includes(type)) return type

  const lower = file.name.toLowerCase()
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  if (lower.endsWith(".doc")) {
    return "application/msword"
  }

  return null
}

interface BuildStoragePathParams {
  userId: string
  workflowId: string
  nodeId: string
  templateFileStem: string
}

function buildWorkflowTemplateStoragePath({
  userId,
  workflowId,
  nodeId,
  templateFileStem,
}: BuildStoragePathParams): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  let ext = ""
  const s = templateFileStem.toLowerCase()
  if (s.endsWith(".docx")) ext = ".docx"
  else if (s.endsWith(".doc")) ext = ".doc"
  else ext = ".docx"

  const base = s.replace(/\.(docx|doc)$/i, "")
  const fileName = `${base}${ext}`
  return `${userId}/${workflowId}/${nodeId}/${stamp}-${fileName}`
}

/**
 * Registers a `.doc`/`.docx` template file in workflow-document-templates storage and workflow_document_templates.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = await params

  if (workflowId === "new") {
    return Response.json(
      { error: "Save your workflow before uploading a template." },
      { status: 400 },
    )
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

  const parsed = await parsePostBody({ request })
  if (parsed.error || !parsed.file || !parsed.nodeId) {
    return Response.json({ error: parsed.error ?? "Invalid request" }, { status: 400 })
  }

  if (parsed.file.size > MAX_BYTES) {
    return Response.json({ error: "File is larger than the 50 MiB bucket limit." }, { status: 400 })
  }

  const mimeType = resolveTemplateMimeType({ file: parsed.file })
  if (!mimeType) {
    return Response.json(
      {
        error: "Only Word templates (.docx or .doc) are allowed.",
      },
      { status: 400 },
    )
  }

  const stem = templateFileStem({ name: parsed.file.name })

  let buffer: Buffer
  try {
    buffer = Buffer.from(await parsed.file.arrayBuffer())
  } catch {
    return Response.json({ error: "Could not read the uploaded file." }, { status: 400 })
  }

  const objectPath = buildWorkflowTemplateStoragePath({
    userId: user.id,
    workflowId,
    nodeId: parsed.nodeId,
    templateFileStem: stem,
  })

  const { error: uploadError } = await supabase.storage
    .from(WORKFLOW_DOCUMENT_TEMPLATES_BUCKET)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from("workflow_document_templates")
    .insert({
      user_id: user.id,
      workflow_id: workflowId,
      name: parsed.file.name,
      bucket: WORKFLOW_DOCUMENT_TEMPLATES_BUCKET,
      path: objectPath,
      mime_type: mimeType,
      size_bytes: buffer.byteLength,
      metadata: {
        category: "document_template",
        node_id: parsed.nodeId,
      },
    })
    .select("id,name,bucket,path,mime_type,size_bytes")
    .single<{ id: string; name: string; bucket: string; path: string; mime_type: string | null; size_bytes: number | null }>()

  if (insertError || !inserted) {
    await supabase.storage.from(WORKFLOW_DOCUMENT_TEMPLATES_BUCKET).remove([objectPath])
    return Response.json(
      {
        error: insertError?.message ?? "Could not save template metadata.",
      },
      { status: 500 },
    )
  }

  return Response.json(inserted)
}
