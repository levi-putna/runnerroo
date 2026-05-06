/**
 * Webhook step — resolves the URL and optional body from tag expressions, fires an HTTP request,
 * and returns the response status code as `exe.status_code` for downstream output mapping.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveDeclaredInputsMap,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

/** HTTP methods that support a request body. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"])

export async function executeWebhookCallStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext({ stepInput, stepId: node.id })

  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs = resolveDeclaredInputsMap({ inputSchema, context })

  // Resolve the request URL from its template expression
  const rawUrl = typeof data?.url === "string" ? data.url : ""
  const resolvedUrl = resolveTemplate(rawUrl, context).trim()

  const method = typeof data?.method === "string" ? data.method.toUpperCase() : "POST"

  // Build fetch options — body only applies to methods that support it
  const fetchOptions: RequestInit = { method }

  if (BODY_METHODS.has(method)) {
    const rawBody = typeof data?.bodyTemplate === "string" ? data.bodyTemplate : ""
    const resolvedBody = rawBody.trim() ? resolveTemplate(rawBody, context) : ""
    if (resolvedBody) {
      fetchOptions.body = resolvedBody
      fetchOptions.headers = { "Content-Type": "application/json" }
    }
  }

  let statusCode = 0
  let responseOk = false
  let errorMessage: string | undefined

  try {
    const response = await fetch(resolvedUrl, fetchOptions)
    statusCode = response.status
    responseOk = response.ok
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  const exeContext: Record<string, unknown> = {
    status_code: statusCode,
    ok: responseOk,
    url: resolvedUrl,
    method,
  }

  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "webhookCall",
    node_id: node.id,
    label,
    ok: !errorMessage,
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
    inputs: resolvedInputs,
  }

  if (errorMessage) {
    resultPayload.error = errorMessage
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
