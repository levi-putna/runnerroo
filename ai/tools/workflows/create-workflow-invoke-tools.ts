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

/** Client-completed tool name that asks the user to approve/decline one pending checkpoint. */
const WORKFLOW_APPROVAL_REQUEST_TOOL_NAME = "workflowApprovalRequest" as const;

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
    "Provide parameters that match the invoke entry input schema. Each result includes __assistantWorkflowName (the workflow title). Other fields are the published End step output. When approvals are required this tool returns `awaiting_approval: true`; immediately call `workflowApprovalRequest` using the returned approval fields and wait for the user's decision output before proceeding.";
  return `${headline} ${tail}`;
}

type EndStepOutputRow = { node_id: string; output: unknown };

type PendingApprovalLookupRow = {
  id: string;
  node_id: string;
  title: string | null;
  description: string | null;
  reviewer_instructions: string | null;
} | null;

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
  pendingApproval,
}: {
  persisted: PersistWorkflowGraphRunResult;
  endStepOutputs: EndStepOutputRow[];
  descriptor: WorkflowAssistantInvokeDescriptor;
  pendingApproval: {
    id: string;
    node_id: string;
    title: string | null;
    description: string | null;
    reviewer_instructions: string | null;
  } | null;
}): Record<string, unknown> {
  const workflowLabel = descriptor.name.trim() || descriptor.workflowId;

  if (persisted.status === "waiting_approval") {
    return withWorkflowInvokeDisplayName({
      workflowLabel,
      payload: {
        success: false,
        awaiting_approval: true,
        run_id: persisted.runId,
        approval_id: pendingApproval?.id ?? null,
        approval_node_id: pendingApproval?.node_id ?? null,
        approval_title: pendingApproval?.title ?? "Approval required",
        approval_description: pendingApproval?.description ?? null,
        approval_reviewer_instructions: pendingApproval?.reviewer_instructions ?? null,
        next_tool_call: WORKFLOW_APPROVAL_REQUEST_TOOL_NAME,
        error: "Workflow paused — review and approve in chat (or Inbox).",
      },
    });
  }

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
 * Fetches the most recent pending approval row for a run so tool outputs can include reviewer copy.
 */
async function fetchPendingApprovalForRun({
  supabase,
  runId,
  userId,
}: {
  supabase: SupabaseClient;
  runId: string;
  userId: string;
}): Promise<PendingApprovalLookupRow> {
  const approvalLookup = await supabase
    .from("workflow_approvals")
    .select("id, node_id, title, description, reviewer_instructions")
    .eq("workflow_run_id", runId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (approvalLookup.error || !approvalLookup.data?.id) return null;
  return approvalLookup.data;
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
    .select("id, name, nodes, edges, trigger_type, run_count, user_id, workflow_constants")
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
    runTrigger: "manual",
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

  let pendingApproval: {
    id: string;
    node_id: string;
    title: string | null;
    description: string | null;
    reviewer_instructions: string | null;
  } | null = null;
  if (persisted.status === "waiting_approval") {
    const approvalLookup = await fetchPendingApprovalForRun({
      supabase,
      runId: persisted.runId,
      userId,
    });
    if (approvalLookup?.id) {
      pendingApproval = {
        id: approvalLookup.id,
        node_id: approvalLookup.node_id,
        title: approvalLookup.title,
        description: approvalLookup.description,
        reviewer_instructions: approvalLookup.reviewer_instructions,
      };
    }
  }

  return buildWorkflowAssistantInvokeToolOutput({
    persisted,
    endStepOutputs,
    descriptor,
    pendingApproval,
  });
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

  tools[WORKFLOW_APPROVAL_REQUEST_TOOL_NAME] = tool({
    description:
      "Client-completed checkpoint prompt for one pending workflow approval. Call this immediately after a workflow tool returns `awaiting_approval: true`. The user chooses approve or decline in the chat UI, and the tool output will contain either the next approval checkpoint or the final workflow result envelope.",
    inputSchema: z.object({
      approval_id: z.string().describe("Pending workflow approval id."),
      run_id: z.string().describe("Workflow run id currently paused on this approval."),
      approval_title: z.string().nullable().optional().describe("Short approval heading."),
      approval_description: z.string().nullable().optional().describe("Optional approval summary."),
      approval_reviewer_instructions: z
        .string()
        .nullable()
        .optional()
        .describe("Expanded reviewer guidance shown to the user."),
    }),
  });
  summaryLines.push(
    `- \`${WORKFLOW_APPROVAL_REQUEST_TOOL_NAME}\` — Present one pending approval to the user in chat and collect approve/decline.`,
  );

  return {
    tools,
    brief: { summaryLines },
  };
}
