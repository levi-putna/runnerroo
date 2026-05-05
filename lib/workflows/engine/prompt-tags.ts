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
