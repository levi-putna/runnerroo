import { tool } from "ai";
import type { Tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { NodeInputField } from "@/lib/workflows/engine/input-schema";
import { parseWorkflowNodes } from "@/lib/workflows/engine/persist";
import {
  persistWorkflowGraphRun,
  type PersistWorkflowGraphRunResult,
} from "@/lib/workflows/persist-workflow-graph-run";
import {
  assistantToolNameForWorkflowId,
  extractEndStepOutputsFromNodeResults,
  listWorkflowAssistantInvokeDescriptors,
  WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY,
  type WorkflowAssistantInvokeDescriptor,
} from "@/lib/workflows/assistant-workflow-invoke-support";

export type WorkflowAssistantInvokeToolsBrief = {
  summaryLines: string[];
};

/**
 * Builds a Zod object schema from persisted entry-node input fields for `tool({ inputSchema })`.
 */
function buildZodSchemaFromInputFields({ fields }: { fields: NodeInputField[] }) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let base: z.ZodTypeAny;
    switch (f.type) {
      case "number":
        base = z.number();
        break;
      case "boolean":
        base = z.boolean();
        break;
      case "json":
        base = z.unknown();
        break;
      case "text":
      case "string":
      default:
        base = z.string();
    }
    let schema = base;
    const desc = f.description?.trim();
    if (desc) {
      schema = schema.describe(desc);
    }
    if (!f.required) {
      schema = schema.optional();
    }
    shape[f.key] = schema;
  }
  return z.object(shape);
}

function buildWorkflowInvokeToolDescription({
  descriptor,
}: {
  descriptor: WorkflowAssistantInvokeDescriptor;
}): string {
  const headline = `Run the user's workflow "${descriptor.name}" (id ${descriptor.workflowId}).`;
  const tail =
    descriptor.description?.trim() ??
    "Provide parameters that match the invoke entry input schema. Each result includes __assistantWorkflowName (the workflow title). Other fields are the published End step output.";
  return `${headline} ${tail}`;
}

type EndStepOutputRow = { node_id: string; output: unknown };

/**
 * Merges the display name last so it wins if an End payload ever reused the same key.
 */
function withWorkflowInvokeDisplayName({
  workflowLabel,
  payload,
}: {
  workflowLabel: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...payload,
    [WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY]: workflowLabel,
  };
}

/**
 * Shapes the workflow invoke tool result for the model: End-step public payloads on success,
 * or a minimal error object on failure. Always includes {@link WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY}.
 */
function buildWorkflowAssistantInvokeToolOutput({
  persisted,
  endStepOutputs,
  descriptor,
}: {
  persisted: PersistWorkflowGraphRunResult;
  endStepOutputs: EndStepOutputRow[];
  descriptor: WorkflowAssistantInvokeDescriptor;
}): Record<string, unknown> {
  const workflowLabel = descriptor.name.trim() || descriptor.workflowId;

  if (persisted.status !== "success") {
    return withWorkflowInvokeDisplayName({
      workflowLabel,
      payload: {
        success: false,
        error: persisted.error ?? "Workflow run failed.",
      },
    });
  }

  if (endStepOutputs.length === 0) {
    return withWorkflowInvokeDisplayName({
      workflowLabel,
      payload: {
        success: false,
        error: "Workflow finished without reaching an End step.",
      },
    });
  }

  const payloads = endStepOutputs.map((row) => row.output).filter((o) => o !== undefined);

  if (payloads.length === 1) {
    const only = payloads[0];
    if (only && typeof only === "object" && !Array.isArray(only)) {
      return withWorkflowInvokeDisplayName({
        workflowLabel,
        payload: only as Record<string, unknown>,
      });
    }
    return withWorkflowInvokeDisplayName({
      workflowLabel,
      payload: {
        success: true,
        value: only as unknown,
      },
    });
  }

  return withWorkflowInvokeDisplayName({
    workflowLabel,
    payload: {
      outputs: payloads,
    },
  });
}

/**
 * Executes a single assistant workflow tool call with ownership checks and persisted attribution.
 */
async function runWorkflowAssistantInvokeExecution({
  supabase,
  userId,
  descriptor,
  inputs,
}: {
  supabase: SupabaseClient;
  userId: string;
  descriptor: WorkflowAssistantInvokeDescriptor;
  inputs: Record<string, unknown>;
}) {
  const { data: workflow, error } = await supabase
    .from("workflows")
    .select("id, name, nodes, edges, trigger_type, run_count, user_id")
    .eq("id", descriptor.workflowId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !workflow) {
    throw new Error("Workflow not found or access denied.");
  }

  const {
    data: { user: runnerUser },
  } = await supabase.auth.getUser();

  const nodes = parseWorkflowNodes(workflow.nodes as unknown);

  const persisted = await persistWorkflowGraphRun({
    supabase,
    workflowId: descriptor.workflowId,
    userId,
    inputs,
    workflow,
    gatewayUserAndWorkflow: {
      supabaseUserId: userId,
      workflowId: descriptor.workflowId,
    },
    runnerIdentity:
      runnerUser != null
        ? {
            displayName:
              typeof runnerUser.user_metadata?.full_name === "string" &&
              runnerUser.user_metadata.full_name.trim() !== ""
                ? runnerUser.user_metadata.full_name.trim()
                : runnerUser.email?.split("@")[0] ?? "",
            email: runnerUser.email ?? null,
          }
        : undefined,
  });

  const endStepOutputs = extractEndStepOutputsFromNodeResults({
    nodes,
    node_results: persisted.node_results,
  });

  return buildWorkflowAssistantInvokeToolOutput({ persisted, endStepOutputs, descriptor });
}

/**
 * Registers one `tool()` per invoke-compatible workflow so parameters mirror each graph's entry schema.
 */
export async function createWorkflowAssistantInvokeTools({
  supabase,
  userId,
  descriptors: descriptorsProvided,
}: {
  supabase: SupabaseClient;
  userId: string;
  /** When set (for example shared with the planning pass), skips a duplicate listing query. */
  descriptors?: WorkflowAssistantInvokeDescriptor[];
}): Promise<{
  tools: Record<string, Tool>;
  brief: WorkflowAssistantInvokeToolsBrief;
}> {
  const descriptors =
    descriptorsProvided ??
    (await listWorkflowAssistantInvokeDescriptors({ supabase, userId }));
  const tools: Record<string, Tool> = {};
  const summaryLines: string[] = [];

  for (const descriptor of descriptors) {
    const toolKey = assistantToolNameForWorkflowId({ workflowId: descriptor.workflowId });
    const inputSchema = buildZodSchemaFromInputFields({ fields: descriptor.inputFields });

    tools[toolKey] = tool({
      description: buildWorkflowInvokeToolDescription({ descriptor }),
      inputSchema,
      execute: async (inputs) =>
        runWorkflowAssistantInvokeExecution({
          supabase,
          userId,
          descriptor,
          inputs: inputs as Record<string, unknown>,
        }),
    });

    summaryLines.push(
      `- \`${toolKey}\` — ${descriptor.name}${
        descriptor.description?.trim() ? `: ${descriptor.description.trim()}` : ""
      }`,
    );
  }

  return {
    tools,
    brief: { summaryLines },
  };
}
