/**
 * Helpers for exposing invoke-compatible workflows as assistant tools (stable tool names, descriptors, output shaping).
 */

import type { Node } from "@xyflow/react"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import { normaliseEntryKind } from "@/lib/workflows/engine/node-type-registry"
import { parseWorkflowNodes } from "@/lib/workflows/engine/persist"
import type { NodeResult } from "@/lib/workflows/engine/types"

/** Prefix for tools shaped as `wf` plus the workflow UUID without hyphens (stable camelCase token). */
export const WORKFLOW_ASSISTANT_TOOL_PREFIX = "wf" as const

/**
 * Property injected on every workflow-invoke tool result so clients (and the model) can show the
 * workflow’s human-readable name. Strip from bespoke result previews when mirroring End-step keys only.
 */
export const WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY = "__assistantWorkflowName" as const

export interface WorkflowAssistantInvokeDescriptor {
  workflowId: string
  name: string
  description: string | null
  inputFields: NodeInputField[]
}

/**
 * Builds the camelCase tool key the assistant sees for a workflow id.
 */
export function assistantToolNameForWorkflowId({ workflowId }: { workflowId: string }): string {
  return `${WORKFLOW_ASSISTANT_TOOL_PREFIX}${workflowId.replace(/-/g, "").toLowerCase()}`
}

/**
 * Renders invoke-compatible workflows for the planning-pass system prompt (tool keys, inputs).
 */
export function formatInvokeWorkflowDescriptorsForPlanningPrompt({
  descriptors,
}: {
  descriptors: WorkflowAssistantInvokeDescriptor[]
}): string {
  return descriptors
    .map((d) => {
      const toolKey = assistantToolNameForWorkflowId({ workflowId: d.workflowId })
      const inputs =
        d.inputFields.length === 0
          ? "(no declared inputs — pass `{}`.)"
          : d.inputFields
              .map((f) => {
                const req = f.required ? ", required" : ", optional"
                const lbl = f.description?.trim() ? ` — ${f.description.trim()}` : ""
                return `${f.key} (${f.type}${req})${lbl}`
              })
              .join("; ")
      const desc = d.description?.trim() ? `\n  Summary: ${d.description.trim()}` : ""
      return `- \`${toolKey}\` — **${d.name}** (workflow id \`${d.workflowId}\`)${desc}\n  Declared inputs: ${inputs}`
    })
    .join("\n\n")
}

/**
 * Parses an assistant workflow tool name back into a UUID, or returns null when malformed.
 */
export function workflowIdFromAssistantToolName({ toolName }: { toolName: string }): string | null {
  if (!toolName.startsWith(WORKFLOW_ASSISTANT_TOOL_PREFIX)) return null
  const hex = toolName.slice(WORKFLOW_ASSISTANT_TOOL_PREFIX.length)
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null
  const h = hex.toLowerCase()
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * True when `toolName` matches {@link assistantToolNameForWorkflowId} encoding.
 */
export function isWorkflowAssistantToolName({ toolName }: { toolName: string }): boolean {
  return workflowIdFromAssistantToolName({ toolName }) !== null
}

/**
 * Collects successful End-node outputs from a finished traversal (preserves `node_results` order).
 */
export function extractEndStepOutputsFromNodeResults({
  nodes,
  node_results,
}: {
  nodes: Node[]
  node_results: NodeResult[]
}): Array<{ node_id: string; output: unknown }> {
  const endIds = new Set(nodes.filter((n) => n.type === "end").map((n) => n.id))
  const out: Array<{ node_id: string; output: unknown }> = []
  for (const r of node_results) {
    if (r.status !== "success") continue
    if (!endIds.has(r.node_id)) continue
    if (r.output === undefined) continue
    out.push({ node_id: r.node_id, output: r.output })
  }
  return out
}

/**
 * Lists workflows whose DB trigger is manual **and** whose graph entry is invoke-compatible (includes legacy `manual` entry types).
 */
export async function listWorkflowAssistantInvokeDescriptors({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}): Promise<WorkflowAssistantInvokeDescriptor[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, description, nodes, status, trigger_type")
    .eq("user_id", userId)
    .in("status", ["active", "draft"])

  if (error || !data) return []

  const out: WorkflowAssistantInvokeDescriptor[] = []
  for (const row of data) {
    if (row.trigger_type !== "manual") continue
    const nodes = parseWorkflowNodes(row.nodes as unknown)
    const entry = nodes.find((n) => n.type === "entry")
    if (!entry?.data || typeof entry.data !== "object") continue
    const et = (entry.data as Record<string, unknown>).entryType
    const entryType = typeof et === "string" ? et : undefined
    if (normaliseEntryKind({ value: entryType }) !== "invoke") continue

    const rawSchema = (entry.data as Record<string, unknown>).inputSchema
    const inputFields = readInputSchemaFromNodeData({ value: rawSchema })

    out.push({
      workflowId: row.id,
      name: row.name,
      description: row.description,
      inputFields,
    })
  }
  return out
}
