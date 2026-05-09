import type { ProviderOptions } from "@ai-sdk/provider-utils"
import { gateway } from "@ai-sdk/gateway"
import { generateObject } from "ai"
import { z } from "zod"

import type { WorkflowInputSchemaFromPromptFlavourId } from "@/lib/workflows/input-schema-from-prompt-flavours"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import { parseInputSchemaJson } from "@/lib/workflows/engine/input-schema"

const WORKFLOW_INPUT_SCHEMA_PROMPT_MODEL =
  process.env.WORKFLOW_INPUT_SCHEMA_PROMPT_MODEL ??
  process.env.NEXT_PUBLIC_ASSISTANT_MODEL ??
  "google/gemini-2.0-flash"

const NODE_INPUT_TYPES = ["string", "text", "number", "boolean", "json"] as const

const workflowFieldDraftSchema = z.object({
  key: z.string().describe("Programmatic snake_case field key matching {{input.key}} (letters, digits, hyphens, underscores only)"),
  label: z.string().optional().describe("Human-readable label for editors"),
  type: z.enum(NODE_INPUT_TYPES).optional().describe("Storage type"),
  required: z.boolean().optional().describe("Whether the field must have a runtime value"),
  description: z
    .string()
    .optional()
    .describe("Short help text for whoever configures the workflow"),
  value: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Suggested default literal, or placeholders such as {{input.text}}, {{trigger_inputs.email}}, {{now.iso}}, or for type json a JSON array/object template; omit when unknown",
    ),
})

const workflowFieldDraftEnvelopeSchema = z.object({
  fields: z.array(workflowFieldDraftSchema).describe("Declarative workflow input fields inferred from the user prompt"),
  notes: z
    .string()
    .optional()
    .describe("Optional clarification for the orchestrator/UI about assumptions or unanswered questions"),
})

const WORKFLOW_SCHEMA_BASE_SYSTEM_PROMPT = [
  "You are a workflow schema assistant for Dailify.",
  "",
  "Produce a JSON-shaped object that lists workflow input FIELD rows for use in the app's schema editor.",
  "",
  "Field rules:",
  '- Every field needs a concise "key" using letters, digits, hyphens (-), and underscores (_) only — prefer lowercase_snake_case.',
  '- "label" should be readable by non-developers when missing, default to deriving from key.',
  '- "type" MUST be one of: string | text | number | boolean | json — use \"json\" when the user needs nested data: objects, or arrays of objects (for example tables or docxtemplater loops {#items} … {/items} fed by `[{...},{...}]`). Pick \"text\" only when long-form content is clearly expected (paragraphs).',
  '- Only mark "required" true when omitting it would reliably break renders or executions.',
  '- "description" is optional but recommended for complex fields — keep it pragmatic.',
  '- "value" is optional; omit it instead of hallucinating literals. When the user cites upstream data, propose useful "{{input.*}}" placeholders (the previous step\'s emitted output) or "{{trigger_inputs.*}}" (the original workflow invoke payload) as strings exactly as spelled.',
  "- Produce between 1 and 30 fields depending on clarity (stay concise when the brief is vague).",
  "- Never invent placeholder keys that contradict the flavour-specific guidance below — stay faithful to explicit user wording.",
  "- Dedupe overlapping keys mentally before returning the array — duplicate keys invalidate the downstream parser.",
].join("\n")

/**
 * Builds the flavour appendix appended after the universal system preamble.
 *
 * @param flavourId - Caller-selected schema generation mode.
 */
function buildFlavourInstructions({ flavourId }: { flavourId: WorkflowInputSchemaFromPromptFlavourId }): string {
  switch (flavourId) {
    case "document_template":
      return [
        "Focus: Word templates rendered via docxtemplater.",
        "",
        "Assume each simple merge tag looks like {field_name} in the DOCX unless the prompt states otherwise — map those names to keys using snake_case.",
        "For repeating sections, docxtemplater uses a single array on the render data (#risks ... /risks iterates rows from an array keyed `risks`). Model that as ONE field: key equals the plural name (e.g. risks), type \"json\", value from {{input.risks}} or a JSON array literal. Each array element must be an object whose keys match the inner loop tags (e.g. description, likelihood, impact, mitigation).",
        "Do not flatten loop rows into separate top-level string fields when a table or list is clearly described — keep them as one json array field unless the user explicitly wants scalars only.",
        "Use \"text\" for multiline blobs and \"string\" for short scalar merges.",
      ].join("\n")

    case "workflow_step_input":
      return [
        "Focus: declarative typed inputs for an arbitrary Dailify workflow step.",
        "",
        "On standard steps, the previous step's emitted output is automatically the current step's input — those values are read as \"{{input.*}}\" downstream.",
        "Trigger (entry) steps additionally publish the workflow invoke payload, which remains accessible on every later step as \"{{trigger_inputs.*}}\".",
        "When the user cites upstream values, prefer \"{{input.*}}\" defaults in \"value\"; reach for \"{{trigger_inputs.*}}\" only for the original invoke payload.",
        "When the user describes nested lists or tabular data, prefer a single \"json\" field whose value is an array of objects with stable keys.",
      ].join("\n")

    default: {
      const unreachable: never = flavourId
      return unreachable
    }
  }
}

export type WorkflowInputSchemaFromPromptAgentResult =
  | { ok: true; fields: NodeInputField[]; notes?: string }
  | { ok: false; error: string }

export interface RunWorkflowInputSchemaFromPromptAgentParams {
  /** Natural-language blueprint from the author. */
  prompt: string
  /** Selects specialised instructions compatible with upcoming schema sinks. */
  flavourId: WorkflowInputSchemaFromPromptFlavourId
  /** Gateway attribution blobs (mandatory tagging for spend tracking). */
  providerOptions?: ProviderOptions
}

/**
 * Calls the gateway-backed model once to coerce a conversational brief into declarative workflow fields,
 * validated through the same pipeline as pasted JSON snippets.
 *
 * @param params - Prompt text, flavour, and optional provider attribution.
 */
export async function runWorkflowInputSchemaFromPromptAgent({
  prompt,
  flavourId,
  providerOptions,
}: RunWorkflowInputSchemaFromPromptAgentParams): Promise<WorkflowInputSchemaFromPromptAgentResult> {
  const trimmed = prompt.trim()
  if (!trimmed) {
    return { ok: false, error: "Prompt is empty." }
  }

  try {
    const { object } = await generateObject({
      model: gateway(WORKFLOW_INPUT_SCHEMA_PROMPT_MODEL),
      schema: workflowFieldDraftEnvelopeSchema,
      system: `${WORKFLOW_SCHEMA_BASE_SYSTEM_PROMPT}

### Flavour (${flavourId})
${buildFlavourInstructions({ flavourId })}`,
      prompt: `User-authored schema brief:\n${trimmed.slice(0, 12_000)}`,
      ...(providerOptions ? { providerOptions } : {}),
    })

    const serialisable = object.fields.map((field) => {
      const row: Record<string, unknown> = {
        key: field.key.trim(),
      }
      if (field.label && field.label.trim()) row.label = field.label.trim()
      if (field.type) row.type = field.type
      if (typeof field.required === "boolean") row.required = field.required
      if (field.description?.trim()) row.description = field.description.trim()
      if (field.value && field.value.trim()) row.value = field.value.trim()
      return row
    })

    const parsed = parseInputSchemaJson({ text: JSON.stringify(serialisable) })
    if (!parsed.ok) {
      return parsed
    }

    const notesTrimmed = object.notes?.trim()
    return {
      ok: true,
      fields: parsed.fields,
      ...(notesTrimmed ? { notes: notesTrimmed } : {}),
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return { ok: false, error: message || "Unable to generate schema." }
  }
}
