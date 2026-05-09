/**
 * Client-safe metadata for “import workflow field schema from a prompt”.
 *
 * Model instructions stay server-side in {@link ../../ai/agents/workflow-input-schema-from-prompt-agent.ts}.
 */

export const WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS = {
  /** Placeholders for docxtemplater-driven document steps (`document_template`). */
  document_template: {
    dialogTitle: "Import template fields from prompt",
    dialogDescription:
      "Describe the Word template placeholders you use (scalar merges and looping tables or lists). " +
      "For docxtemplater loops such as {#risks}…{/risks}, use one JSON-typed field keyed risks whose value resolves to an array of objects (for example description, likelihood). " +
      "We will propose matching workflow field keys and types.",
  },
  /** Generic typed inputs referenced as placeholders such as `{{input.key}}` on any step. */
  workflow_step_input: {
    dialogTitle: "Import input fields from prompt",
    dialogDescription:
      "Describe each value this step needs at runtime — names, types, and whether callers must supply them. " +
      "We will propose a matching input schema.",
  },
} as const

export type WorkflowInputSchemaFromPromptFlavourId = keyof typeof WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS

/** Preset for InputSchemaBuilder `promptImport` on inbound `inputSchema` panels (step Input tab, Entry payload, etc.). */
export const WORKFLOW_STEP_INPUT_PROMPT_IMPORT = {
  flavourId: "workflow_step_input",
} as const satisfies { flavourId: WorkflowInputSchemaFromPromptFlavourId }

/** Docxtemplater template field list — uses the document-specific model instructions. */
export const WORKFLOW_DOCUMENT_TEMPLATE_PROMPT_IMPORT = {
  flavourId: "document_template",
} as const satisfies { flavourId: WorkflowInputSchemaFromPromptFlavourId }

/** Outbound `outputSchema` rows — same {@link NodeInputField} model as inputs; copy orients the model toward downstream mappings. */
export const WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT = {
  flavourId: "workflow_step_input",
  dialogTitle: "Import output fields from prompt",
  dialogDescription:
    "Describe each key this step should expose downstream (human labels, types, required flags, and any {{exe.*}}, {{input.*}}, or {{trigger_inputs.*}} mapping hints you want suggested). " +
    "We will propose matching output schema rows.",
} as const satisfies { flavourId: WorkflowInputSchemaFromPromptFlavourId; dialogTitle: string; dialogDescription: string }

/** `globalsSchema` panels — keys become {{global.*}} for later steps. */
export const WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT = {
  flavourId: "workflow_step_input",
  dialogTitle: "Import globals from prompt",
  dialogDescription:
    "Describe workflow-level global keys (readable names, optional descriptions, and suggested tag expressions where helpful). " +
    "We will propose matching globals schema rows.",
} as const satisfies { flavourId: WorkflowInputSchemaFromPromptFlavourId; dialogTitle: string; dialogDescription: string }

/**
 * Parses an API-supplied flavour id into a typed key known to {@link WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS}.
 *
 * @param params - Raw candidate extracted from JSON.
 */
export function normaliseWorkflowInputSchemaPromptFlavourCandidate({
  candidate,
}: {
  candidate: unknown
}): WorkflowInputSchemaFromPromptFlavourId | null {
  if (typeof candidate !== "string" || !(candidate in WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS)) {
    return null
  }
  return candidate as WorkflowInputSchemaFromPromptFlavourId
}
