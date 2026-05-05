import type { Node } from "@xyflow/react"
import Docxtemplater from "docxtemplater"
import PizZip from "pizzip"

import { readRunnerGatewayExecutionContextFromStepInput } from "@/lib/ai-gateway/runner-gateway-tracking"
import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import { buildResolutionContext, resolveGlobalsSchema, resolveTemplate } from "@/lib/workflows/engine/template"
import { createClient } from "@/lib/supabase/server"
import { WORKFLOW_DOCUMENT_OUTPUTS_BUCKET } from "@/lib/workflows/storage/workflow-document-buckets"

interface WorkflowTemplateRecord {
  id: string
  user_id: string
  workflow_id: string | null
  name: string
  bucket: string
  path: string
}

/**
 * Coerces a resolved schema value into the most useful runtime type for docxtemplater.
 *
 * Use `type: "json"` when the template declares a loop (`{#risks}` … `{/risks}`) and `value` resolves
 * to JSON such as `[{"description":"Scope creep…","likelihood":"High","impact":"High","mitigation":"Formal CCB…"}]`.
 * Legacy rows can still rely on heuristic JSON parsing when literals start with `[` or `{`.
 */
function parseDocumentSchemaValue({
  text,
  type,
}: {
  text: string
  type?: string
}): unknown {
  const trimmed = text.trim()
  if (!trimmed) return ""

  if (type === "number") {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : trimmed
  }

  if (type === "boolean") {
    if (trimmed === "true") return true
    if (trimmed === "false") return false
  }

  if (type === "json") {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return trimmed
    }
  }

  // Support nested loop/object schemas by allowing JSON payload strings without an explicit `json` type.
  if (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null"
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  return trimmed
}

/**
 * Builds the schema object passed to docxtemplater from node `documentSchema` rows.
 */
function buildDocumentSchema({
  nodeData,
  context,
}: {
  nodeData: Record<string, unknown> | undefined
  context: Record<string, unknown>
}): Record<string, unknown> {
  const documentSchema = readInputSchemaFromNodeData({ value: nodeData?.documentSchema })
  const resolvedSchema: Record<string, unknown> = {}

  for (const field of documentSchema) {
    if (!field.value) continue
    const resolved = resolveTemplate(field.value, context)
    resolvedSchema[field.key] = parseDocumentSchemaValue({ text: resolved, type: field.type })
  }

  return resolvedSchema
}

/**
 * Generates a document from a stored template and uploads the output artefact to storage.
 */
export async function executeGenerateDocumentStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const supabase = await createClient()
  const nodeData = node.data as Record<string, unknown> | undefined
  const label = typeof nodeData?.label === "string" ? nodeData.label : node.id
  const templateFileId = typeof nodeData?.templateFileId === "string" ? nodeData.templateFileId.trim() : ""
  if (!templateFileId) {
    throw new Error('Generate document step requires "templateFileId".')
  }

  const context = buildResolutionContext(stepInput)
  const gatewayContext = readRunnerGatewayExecutionContextFromStepInput({ stepInput })

  let templateQuery = supabase
    .from("workflow_document_templates")
    .select("id,user_id,workflow_id,name,bucket,path")
    .eq("id", templateFileId)
  if (gatewayContext?.supabaseUserId) {
    templateQuery = templateQuery.eq("user_id", gatewayContext.supabaseUserId)
  }

  const { data: templateRecord, error: templateError } = await templateQuery.single<WorkflowTemplateRecord>()
  if (templateError || !templateRecord) {
    throw new Error(`Template not found for id "${templateFileId}".`)
  }

  const { data: templateBlob, error: downloadError } = await supabase
    .storage
    .from(templateRecord.bucket)
    .download(templateRecord.path)
  if (downloadError || !templateBlob) {
    throw new Error("Could not download the template document from storage.")
  }

  const templateBuffer = Buffer.from(await templateBlob.arrayBuffer())
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

  const resolvedDocumentSchema = buildDocumentSchema({ nodeData, context })
  doc.render(resolvedDocumentSchema)

  const outputBuffer = doc.getZip().generate({ type: "nodebuffer" })
  const safeOutputFileName =
    typeof nodeData?.outputFileName === "string" && nodeData.outputFileName.trim()
      ? nodeData.outputFileName.trim()
      : "generated-document.docx"
  const outputFileName = safeOutputFileName.endsWith(".docx")
    ? safeOutputFileName
    : `${safeOutputFileName}.docx`

  const userIdPath = templateRecord.user_id
  const runSegment =
    gatewayContext?.workflowRunId && gatewayContext.workflowRunId.length > 0
      ? gatewayContext.workflowRunId
      : `run-${Date.now()}`
  const outputPath = `${userIdPath}/${runSegment}/${node.id}/${outputFileName}`
  const outputBucket = WORKFLOW_DOCUMENT_OUTPUTS_BUCKET

  const { error: uploadError } = await supabase
    .storage
    .from(outputBucket)
    .upload(outputPath, outputBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    })
  if (uploadError) {
    throw new Error("Could not upload the generated document to storage.")
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from(outputBucket)
    .createSignedUrl(outputPath, 3600)
  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error("Could not create a signed URL for the generated document.")
  }

  const { error: artefactInsertError } = await supabase.from("user_files").insert({
    user_id: templateRecord.user_id,
    bucket: outputBucket,
    path: outputPath,
    name: outputFileName,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: outputBuffer.byteLength,
    metadata: {
      category: "document_output",
      workflow_id: gatewayContext?.workflowId ?? templateRecord.workflow_id,
      workflow_run_id: gatewayContext?.workflowRunId ?? null,
      node_id: node.id,
      template_file_id: templateRecord.id,
    },
  })
  if (artefactInsertError) {
    throw new Error("Generated document was uploaded, but artefact metadata could not be saved.")
  }

  const exeContext: Record<string, unknown> = {
    templateFileId: templateRecord.id,
    templateName: templateRecord.name,
    outputBucket,
    outputPath,
    outputFileName,
    documentUrl: signedUrlData.signedUrl,
  }

  const outputSchema = readInputSchemaFromNodeData({ value: nodeData?.outputSchema })
  const outputContext = { ...context, exe: exeContext }
  const resolvedOutputs: Record<string, unknown> = {}
  for (const field of outputSchema) {
    if (!field.value) continue
    resolvedOutputs[field.key] = resolveTemplate(field.value, outputContext)
  }

  const globalsSchema = readInputSchemaFromNodeData({ value: nodeData?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "document",
    node_id: node.id,
    label,
    ok: true,
    template_file_id: templateRecord.id,
    document_bucket: outputBucket,
    document_path: outputPath,
    document_url: signedUrlData.signedUrl,
    outputs: resolvedOutputs,
    exe: exeContext,
    schema: resolvedDocumentSchema,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
