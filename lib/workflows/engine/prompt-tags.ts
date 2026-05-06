import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData, type NodeInputField } from "@/lib/workflows/engine/input-schema"
import { inferPreviousStepOutputFields } from "@/lib/workflows/engine/previous-step-import"

/**
 * One insertable prompt token (shown as `{{id}}` in the editor) with metadata for autocomplete and help text.
 */
export interface PromptTagDefinition {
  /** Token inside the braces, e.g. `input.customer_name` for `{{input.customer_name}}`. */
  id: string
  /** Short label used for filtering and the primary line in the suggestion list. */
  label: string
  /** Human-readable explanation (shown up to two lines in the picker and expanded dialog). */
  description: string
}

/**
 * Workflow-wide tokens available in every tagged expression field (prompts, defaults, etc.).
 * Resolution semantics are defined by the runner — here we document intent for authors.
 */
export const GLOBAL_PROMPT_TAGS: PromptTagDefinition[] = [
  {
    id: "now.iso",
    label: "Now (ISO 8601)",
    description:
      "Current UTC timestamp as an ISO 8601 string when the workflow resolves this expression.",
  },
  {
    id: "now.unix_ms",
    label: "Now (Unix ms)",
    description: "Current time as Unix epoch milliseconds when this expression is resolved.",
  },
  {
    id: "now.date",
    label: "Today (UTC date)",
    description: "Current calendar date in UTC as YYYY-MM-DD when this expression is resolved.",
  },
  {
    id: "now.year",
    label: "Now · year (UTC)",
    description: "Four-digit calendar year in UTC when this expression is resolved.",
  },
  {
    id: "now.day",
    label: "Now · day of month (UTC)",
    description: "Day of the month in UTC (1–31) when this expression is resolved.",
  },
  {
    id: "now.month",
    label: "Now · month number (UTC)",
    description:
      "Month number in UTC (1 = January through 12 = December) when this expression is resolved.",
  },
  {
    id: "now.month_full",
    label: "Now · month name (UTC, full)",
    description:
      "Full month name in UTC using the Australian English locale when this expression is resolved.",
  },
  {
    id: "now.month_short",
    label: "Now · month name (UTC, short)",
    description:
      "Abbreviated month name in UTC using the Australian English locale when this expression is resolved.",
  },
  {
    id: "now.time_24",
    label: "Now · time 24-hour (UTC)",
    description:
      "Current UTC time as HH:mm:ss (24-hour, zero-padded) when this expression is resolved.",
  },
  {
    id: "now.time_12",
    label: "Now · time 12-hour (UTC)",
    description:
      "Current UTC time as h:mm:ss am/pm when this expression is resolved.",
  },
  {
    id: "run.id",
    label: "Run · id",
    description:
      "Persisted workflow run row id for this traversal when attribution is present; empty otherwise.",
  },
  {
    id: "workflow.id",
    label: "Workflow · id",
    description:
      "Workflow definition id carried on the run envelope when attribution is present; empty otherwise.",
  },
  {
    id: "workflow.name",
    label: "Workflow · name",
    description:
      "Persisted workflow title captured when the run starts; empty if not supplied on the envelope.",
  },
  {
    id: "step.id",
    label: "Step · graph node id",
    description:
      "React Flow id of the node currently resolving this tagged expression.",
  },
  {
    id: "user.name",
    label: "Runner · display name",
    description:
      "Signed-in workflow owner display name captured when the run starts (Australian English authoring context); empty if unknown.",
  },
  {
    id: "user.email",
    label: "Runner · email",
    description:
      "Signed-in workflow owner email captured when the run starts; empty if unknown.",
  },
  {
    id: "now.day_of_year",
    label: "Now · day of year (UTC)",
    description:
      "Ordinal calendar day within the UTC year (1–366) when this expression is resolved.",
  },
  {
    id: "now.weekday_number",
    label: "Now · weekday ISO (UTC)",
    description:
      "ISO weekday number in UTC: 1 = Monday through 7 = Sunday when this expression is resolved.",
  },
  {
    id: "now.weekday_full",
    label: "Now · weekday (UTC, full)",
    description:
      "Full weekday name in UTC using the Australian English locale when this expression is resolved.",
  },
  {
    id: "now.weekday_short",
    label: "Now · weekday (UTC, short)",
    description:
      "Abbreviated weekday in UTC using the Australian English locale when this expression is resolved.",
  },
  {
    id: "now.slug_timestamp",
    label: "Now · slug timestamp (UTC)",
    description:
      "Current UTC instant as `YYYY-MM-DD_HH-mm-ss`, suitable for filesystem-friendly prefixes.",
  },
]

export interface MergePromptTagDefinitionsParams {
  contextual: PromptTagDefinition[]
}

/**
 * Returns globals first, then contextual tags — duplicate ids keep the first occurrence only.
 */
export function mergePromptTagDefinitions({
  contextual,
}: MergePromptTagDefinitionsParams): PromptTagDefinition[] {
  const seen = new Set<string>()
  const out: PromptTagDefinition[] = []
  for (const t of GLOBAL_PROMPT_TAGS) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  for (const t of contextual) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  return out
}

export interface WorkflowGlobalsPromptTagsFromNodesParams {
  nodes: Node[]
}

/**
 * Collects distinct `globalsSchema` keys from every node so authors get `{{global.key}}` suggestions.
 */
export function workflowGlobalsPromptTagsFromNodes({
  nodes,
}: WorkflowGlobalsPromptTagsFromNodesParams): PromptTagDefinition[] {
  const seenKeys = new Set<string>()
  const out: PromptTagDefinition[] = []
  for (const n of nodes) {
    const data = n.data as Record<string, unknown> | undefined
    const fields = readInputSchemaFromNodeData({ value: data?.globalsSchema })
    for (const field of fields) {
      const key = field.key.trim()
      if (!key || seenKeys.has(key)) continue
      seenKeys.add(key)
      const token = `global.${key}`
      out.push({
        id: token,
        label: field.label?.trim() || key,
        description: `Workflow global “${key}”, referenced as {{${token}}}. Values shallow-merge along the run; a later step can override this key.`,
      })
    }
  }
  return out
}

export interface NodeInputFieldsToPromptTagsParams {
  fields: NodeInputField[]
}

/**
 * Maps declared workflow input fields to prompt tags of the form `{{input.<key>}}`.
 */
export function nodeInputFieldsToPromptTags({
  fields,
}: NodeInputFieldsToPromptTagsParams): PromptTagDefinition[] {
  return fields.map((field) => {
    const token = `input.${field.key}`
    const dv = field.value?.trim()
    const baseDescription =
      field.description?.trim() ||
      `Inbound value for “${field.label}”, referenced as {{${token}}} in the prompt.`
    const valueSuffix = dv ? ` Value when missing: ${dv}.` : ""
    const description = `${baseDescription}${valueSuffix}`
    return {
      id: token,
      label: field.label?.trim() || field.key,
      description,
    }
  })
}

export interface PrevPromptTagsFromPredecessorParams {
  /** Inbound predecessor for the current step (`null` when unconnected). */
  previousNode: Node | null | undefined
}

/**
 * Maps the selected predecessor’s inferable output shape to prompt tags `{{prev.*}}` for autocomplete.
 */
export function prevPromptTagsFromPredecessorNode({
  previousNode,
}: PrevPromptTagsFromPredecessorParams): PromptTagDefinition[] {
  if (!previousNode) return []
  const inferred = inferPreviousStepOutputFields({ previousNode })
  return inferred.map((f) => {
    const trimmed = f.suggestedValue.trim()
    const inner = trimmed.startsWith("{{") && trimmed.endsWith("}}") ? trimmed.slice(2, -2).trim() : trimmed
    return {
      id: inner,
      label: f.label.trim() || inner,
      description: `Upstream step output field “${f.key}”. Use {{${inner}}} wherever this step resolves tagged expressions.`,
    }
  })
}

/**
 * Prompt tags for Webhook steps — expose the HTTP status code from `exe.*` after the call completes.
 */
export function webhookCallExePromptTags(): PromptTagDefinition[] {
  return [
    {
      id: "exe.status_code",
      label: "Execution · HTTP status code",
      description:
        "Numeric HTTP status code returned by the remote server after the webhook call (e.g. 200, 201, 400, 500).",
    },
    {
      id: "exe.ok",
      label: "Execution · response ok",
      description:
        'Boolean — true when the server returned a 2xx status code, false otherwise. Use "true" or "false" in expressions.',
    },
  ]
}

/**
 * Prompt tags exposed when an Approval step completes after approval — fills `exe.*` for Output tab mappings.
 */
export function approvalExePromptTags(): PromptTagDefinition[] {
  return [
    {
      id: "exe.decision",
      label: "Execution · decision",
      description: "After a successful inbox review this is always the string approved.",
    },
    {
      id: "exe.responded_at",
      label: "Execution · responded at",
      description: "ISO 8601 timestamp when the reviewer approved or declined.",
    },
  ]
}

/**
 * Prompt tag for numeric steps that expose a single `exe.number` execution field (random draw, iteration result).
 */
export function numericExeNumberPromptTags(): PromptTagDefinition[] {
  return [
    {
      id: "exe.number",
      label: "Execution · number",
      description:
        "Numeric result from this step’s execution: a random draw between resolved bounds, or starting value plus increment.",
    },
  ]
}

/**
 * Prompt tags that mirror fields exposed by Vercel AI SDK `GenerateTextResult` (non-streaming `generateText`).
 * Use under the `exe.` prefix so authors map outbound outputs after the model call completes.
 *
 * **Note:** `generateText` does not return billed currency directly — expose spend via your runner/gateway if needed.
 */
export function generateTextExecutionPromptTags(): PromptTagDefinition[] {
  return [
    {
      id: "exe.text",
      label: "Execution · assistant text",
      description:
        "Final assistant-visible text from the last generation step (`GenerateTextResult.text`). Maps to model output.",
    },
    {
      id: "exe.reasoningText",
      label: "Execution · reasoning text",
      description:
        "Consolidated reasoning / thinking text when the model emits it (`GenerateTextResult.reasoningText`). Empty when absent.",
    },
    {
      id: "exe.finishReason",
      label: "Execution · finish reason",
      description: "Normalized completion reason (`GenerateTextResult.finishReason`), e.g. stop, length, tool-calls.",
    },
    {
      id: "exe.rawFinishReason",
      label: "Execution · raw finish reason",
      description: "Provider-native finish reason string when supplied (`GenerateTextResult.rawFinishReason`).",
    },
    {
      id: "exe.response.modelId",
      label: "Execution · response model id",
      description: "Model identifier reported on the response (`GenerateTextResult.response.modelId`).",
    },
    {
      id: "exe.response.id",
      label: "Execution · response id",
      description: "Provider response identifier (`GenerateTextResult.response.id`).",
    },
    {
      id: "exe.usage.inputTokens",
      label: "Execution · prompt tokens (last step)",
      description: "Input tokens for the final generation step (`GenerateTextResult.usage.inputTokens`).",
    },
    {
      id: "exe.usage.outputTokens",
      label: "Execution · completion tokens (last step)",
      description: "Output tokens for the final generation step (`GenerateTextResult.usage.outputTokens`).",
    },
    {
      id: "exe.usage.totalTokens",
      label: "Execution · total tokens (last step)",
      description: "Total tokens for the final generation step (`GenerateTextResult.usage.totalTokens`).",
    },
    {
      id: "exe.usage.outputTokenDetails.reasoningTokens",
      label: "Execution · reasoning tokens (last step)",
      description:
        "Tokens attributed to reasoning in the final step (`GenerateTextResult.usage.outputTokenDetails.reasoningTokens`).",
    },
    {
      id: "exe.totalUsage.inputTokens",
      label: "Execution · prompt tokens (all steps)",
      description: "Summed input tokens across tool/multi-steps (`GenerateTextResult.totalUsage.inputTokens`).",
    },
    {
      id: "exe.totalUsage.outputTokens",
      label: "Execution · completion tokens (all steps)",
      description: "Summed output tokens across steps (`GenerateTextResult.totalUsage.outputTokens`).",
    },
    {
      id: "exe.totalUsage.totalTokens",
      label: "Execution · total tokens (all steps)",
      description: "Summed total tokens across steps (`GenerateTextResult.totalUsage.totalTokens`).",
    },
    {
      id: "exe.steps.length",
      label: "Execution · step count",
      description:
        "Number of generation steps recorded (`GenerateTextResult.steps.length`), including tool loops when applicable.",
    },
  ]
}

export interface ExtractObjectExecutionPromptTagsParams {
  /** Author-declared extraction fields — one `exe.<key>` tag is generated per row. */
  fields: Array<{ key: string; label: string; description: string }>
}

/**
 * Generates dynamic `{{exe.<key>}}` prompt tags for Extract steps.
 * One tag per declared field, plus shared telemetry tags.
 */
export function extractObjectExecutionPromptTags({
  fields,
}: ExtractObjectExecutionPromptTagsParams): PromptTagDefinition[] {
  const fieldTags: PromptTagDefinition[] = fields.map((f) => ({
    id: `exe.${f.key}`,
    label: `Extraction · ${f.label || f.key}`,
    description:
      f.description.trim() ||
      `Extracted value for "${f.label || f.key}" from the model output. Map to an outbound field via the Output schema.`,
  }))

  return [
    ...fieldTags,
    {
      id: "exe.finishReason",
      label: "Execution · finish reason",
      description: "Structured generation finish reason (`GenerateObjectResult.finishReason`) when emitted by the provider.",
    },
    {
      id: "exe.usage.inputTokens",
      label: "Execution · prompt tokens",
      description: "Input tokens billed for this structured extraction call.",
    },
    {
      id: "exe.usage.outputTokens",
      label: "Execution · completion tokens",
      description: "Output tokens billed for this structured extraction call.",
    },
    {
      id: "exe.usage.totalTokens",
      label: "Execution · total tokens",
      description: "Total tokens for this extraction call.",
    },
  ]
}

/**
 * Prompt tags for Classify workflow steps backed by structured `generateObject` output (`exe.classifier_*`).
 */
export function classifyObjectExecutionPromptTags(): PromptTagDefinition[] {
  return [
    {
      id: "exe.classifier_label",
      label: "Execution · classifier label",
      description:
        "Exact category identifier chosen by the classifier — must equal one catalogue `label` value from this step.",
    },
    {
      id: "exe.classifier_confidence",
      label: "Execution · classifier confidence",
      description:
        "Self-reported subjective certainty between 0 and 1 inclusive from the structured classifier output.",
    },
    {
      id: "exe.classifier_reasoning",
      label: "Execution · classifier reasoning",
      description:
        "Short rationale from the classifier; authors should map outbound fields from this execution property.",
    },
    {
      id: "exe.finishReason",
      label: "Execution · finish reason",
      description: "Structured generation finish reason (`GenerateObjectResult.finishReason`) when emitted by the provider.",
    },
    {
      id: "exe.usage.inputTokens",
      label: "Execution · prompt tokens",
      description: "Input tokens billed for this structured generation call.",
    },
    {
      id: "exe.usage.outputTokens",
      label: "Execution · completion tokens",
      description: "Output tokens billed for this structured generation call.",
    },
    {
      id: "exe.usage.totalTokens",
      label: "Execution · total tokens",
      description: "Total tokens for this classifier call.",
    },
  ]
}
