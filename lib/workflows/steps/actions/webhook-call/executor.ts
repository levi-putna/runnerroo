/**
 * Webhook step — resolves the URL and optional body from tag expressions, fires an HTTP request,
 * and returns the response status code as `exe.status_code` for downstream output mapping.
 *
 * Failure modes are normalised: an invalid / non-`http(s)` URL or a thrown `fetch` error both
 * leave `status_code: 0`, `ok: false`, and an `error` string on the payload — `outputSchema`
 * still resolves so downstream branches can inspect the failure.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

/** HTTP methods that support a request body. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"])

interface ValidateOutboundWebhookUrlParams {
  /** URL string after template resolution (already trimmed by the caller). */
  resolvedUrl: string
}

type ValidateOutboundWebhookUrlResult =
  | { ok: true; url: string }
  | { ok: false; message: string }

/**
 * Ensures we only call `fetch` with a well-formed `http:` / `https:` URL.
 *
 * Catches the easy authoring mistakes that otherwise surface as opaque `fetch` rejections:
 *  - empty string after template resolution (e.g. `{{prev.url}}` was undefined),
 *  - relative paths or scheme-less strings,
 *  - exotic schemes (`file:`, `chrome:`, `javascript:`, etc.).
 */
function validateOutboundWebhookUrl({
  resolvedUrl,
}: ValidateOutboundWebhookUrlParams): ValidateOutboundWebhookUrlResult {
  if (resolvedUrl === "") {
    return { ok: false, message: "Webhook URL is empty after resolving templates." }
  }
  let parsed: URL
  try {
    parsed = new URL(resolvedUrl)
  } catch {
    return { ok: false, message: "Webhook URL is not a valid absolute URL." }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      message: `Webhook URL must use http or https (received ${parsed.protocol}).`,
    }
  }
  return { ok: true, url: resolvedUrl }
}

export async function executeWebhookCallStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  // ─── Resolution context ───────────────────────────────────────────────────
  // Single base context shared by every template lookup in this executor. The URL/body
  // templates can reference the upstream payload directly via `{{input.*}}`.
  const context = buildResolutionContext({ stepInput, stepId: node.id })

  // ─── Request line — URL, method, optional JSON body ───────────────────────
  const rawUrl = typeof data?.url === "string" ? data.url : ""
  const resolvedUrl = resolveTemplate(rawUrl, context).trim()

  const method = typeof data?.method === "string" ? data.method.toUpperCase() : "POST"

  const fetchOptions: RequestInit = { method }

  if (BODY_METHODS.has(method)) {
    const rawBody = typeof data?.bodyTemplate === "string" ? data.bodyTemplate : ""
    const resolvedBody = rawBody.trim() ? resolveTemplate(rawBody, context) : ""
    if (resolvedBody) {
      fetchOptions.body = resolvedBody
      fetchOptions.headers = { "Content-Type": "application/json" }
    }
  }

  // ─── HTTP call (with up-front URL validation) ─────────────────────────────
  let statusCode = 0
  let responseOk = false
  let errorMessage: string | undefined

  const urlCheck = validateOutboundWebhookUrl({ resolvedUrl })
  if (!urlCheck.ok) {
    // Skip `fetch` entirely so we surface a clear authoring error rather than a
    // generic network rejection. Keep `resolvedUrl` on `exe` for debugging.
    errorMessage = urlCheck.message
  } else {
    try {
      const response = await fetch(urlCheck.url, fetchOptions)
      statusCode = response.status
      responseOk = response.ok
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
    }
  }

  // ─── Output + globals ─────────────────────────────────────────────────────
  // `exe` exposes the HTTP outcome to outputSchema / globalsSchema templates so
  // authors can map `{{exe.status_code}}`, `{{exe.ok}}`, etc.
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
  }

  if (errorMessage) {
    resultPayload.error = errorMessage
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
