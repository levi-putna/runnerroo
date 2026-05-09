/**
 * Executes a `document` node with `subtype === "docxml"`: model emits XML, docxml renders .docx, upload to storage.
 */

import type { Node } from "@xyflow/react"
import { generateText } from "ai"

import {
  buildRunnerGatewayProviderOptions,
  gatewayUsageTagsForWorkflowRun,
  readRunnerGatewayExecutionContextFromStepInput,
} from "@/lib/ai-gateway/runner-gateway-tracking"
import { DEFAULT_MODEL_ID, resolveWorkflowGatewayModelId } from "@/lib/ai-gateway/models"
import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"
import { createClient } from "@/lib/supabase/server"
import { WORKFLOW_DOCUMENT_OUTPUTS_BUCKET } from "@/lib/workflows/storage/workflow-document-buckets"
import { buildDocxUint8ArrayFromContentXml } from "@/lib/workflows/steps/documents/document-xml/build-docx-from-xml"
import { DOCUMENT_XML_DEFAULT_SYSTEM_PROMPT } from "@/lib/workflows/steps/documents/document-xml/defaults"
import { ensureDocumentRootXml, extractContentXmlFromModelText } from "@/lib/workflows/steps/documents/document-xml/model-xml"

/**
 * Runs prompt resolution, asks the gateway model for XML, converts via docxml, uploads, and returns the standard document payload shape.
 */
export async function executeDocumentFromXmlStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const nodeData = node.data as Record<string, unknown> | undefined
  const label = typeof nodeData?.label === "string" ? nodeData.label : node.id

  const gatewayContext = readRunnerGatewayExecutionContextFromStepInput({ stepInput })
  if (!gatewayContext?.supabaseUserId) {
    throw new Error("Generate document (XML) step requires workflow gateway context with a Supabase user id.")
  }

  const rawModelId =
    typeof nodeData?.model === "string" && nodeData.model.trim() !== ""
      ? nodeData.model
      : DEFAULT_MODEL_ID
  const gatewayModelId = resolveWorkflowGatewayModelId({ modelId: rawModelId })
  const promptTemplate = typeof nodeData?.prompt === "string" ? nodeData.prompt : ""

  const context = buildResolutionContext({ stepInput, stepId: node.id })
  const resolvedPrompt = resolveTemplate(promptTemplate, context)
  const resolvedSystem = resolveTemplate(DOCUMENT_XML_DEFAULT_SYSTEM_PROMPT, context)

  const providerOptions = buildRunnerGatewayProviderOptions({
    supabaseUserId: gatewayContext.supabaseUserId,
    tags: gatewayUsageTagsForWorkflowRun({
      workflowRunId: gatewayContext.workflowRunId,
    }),
  })

  const gen = await generateText({
    model: gatewayModelId,
    prompt: resolvedPrompt,
    system: resolvedSystem,
    providerOptions,
  })

  const extracted = extractContentXmlFromModelText({ text: gen.text })
  const contentXml = ensureDocumentRootXml({ xml: extracted })

  let docxBytes: Uint8Array
  try {
    docxBytes = await buildDocxUint8ArrayFromContentXml({ xml: contentXml })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`docxml could not render model XML into a document: ${message}`)
  }

  const outputBuffer = Buffer.from(docxBytes)
  const outputFileNameTemplateRaw =
    typeof nodeData?.outputFileName === "string" ? nodeData.outputFileName.trim() : ""
  const outputFileNameTemplate =
    outputFileNameTemplateRaw.length > 0 ? outputFileNameTemplateRaw : "generated-document.docx"
  const resolvedOutputStem = resolveTemplate(outputFileNameTemplate, context).trim()
  const safeOutputFileName =
    resolvedOutputStem.length > 0 ? resolvedOutputStem : "generated-document.docx"
  const outputFileName = safeOutputFileName.endsWith(".docx")
    ? safeOutputFileName
    : `${safeOutputFileName}.docx`

  const userIdPath = gatewayContext.supabaseUserId
  const outputPath = `${userIdPath}/${gatewayContext.workflowRunId}/${node.id}/${outputFileName}`
  const outputBucket = WORKFLOW_DOCUMENT_OUTPUTS_BUCKET

  const supabase = await createClient()

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
    user_id: gatewayContext.supabaseUserId,
    bucket: outputBucket,
    path: outputPath,
    name: outputFileName,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: outputBuffer.byteLength,
    metadata: {
      category: "document_output",
      workflow_id: gatewayContext.workflowId,
      workflow_run_id: gatewayContext.workflowRunId,
      node_id: node.id,
      generation_kind: "docxml",
    },
  })
  if (artefactInsertError) {
    throw new Error("Generated document was uploaded, but artefact metadata could not be saved.")
  }

  const exeContext: Record<string, unknown> = {
    templateFileId: "",
    templateName: "",
    outputBucket,
    outputPath,
    outputFileName,
    documentUrl: signedUrlData.signedUrl,
    generationKind: "docxml",
    gatewayModelId,
    contentXmlCharLength: contentXml.length,
    usage: {
      inputTokens: gen.usage?.inputTokens ?? 0,
      outputTokens: gen.usage?.outputTokens ?? 0,
      totalTokens: gen.usage?.totalTokens ?? 0,
    },
  }

  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: nodeData?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: nodeData?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "document",
    node_id: node.id,
    label,
    ok: true,
    template_file_id: null,
    document_bucket: outputBucket,
    document_path: outputPath,
    document_url: signedUrlData.signedUrl,
    outputs: resolvedOutputs,
    exe: exeContext,
    text: gen.text,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
