/**
 * Persists and executes a workflow graph for an authenticated owner — shared by the SSE run route
 * and assistant invoke tools.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { NodeResult } from "@/lib/workflows/engine/types"
import {
  mergeNodeResultsIntoList,
  traverseWorkflowGraph,
} from "@/lib/workflows/engine/runner"
import {
  parseWorkflowEdges,
  parseWorkflowNodes,
} from "@/lib/workflows/engine/persist"
import { createWorkflowStepExecutor } from "@/lib/workflows/engine/step-executor"
import type { RunnerGatewayExecutionContext } from "@/lib/ai-gateway/runner-gateway-tracking"
import type { Json } from "@/types/database"

export type PersistWorkflowGraphRunWorkflowRow = {
  trigger_type: string
  run_count: number | null
  nodes: unknown
  edges: unknown
}

export interface PersistWorkflowGraphRunParams {
  supabase: SupabaseClient
  workflowId: string
  userId: string
  inputs: Record<string, unknown>
  workflow: PersistWorkflowGraphRunWorkflowRow
  /** Attribution forwarded after the run row id is allocated (see {@link RunnerGatewayExecutionContext}). */
  gatewayUserAndWorkflow: Pick<RunnerGatewayExecutionContext, "supabaseUserId" | "workflowId">
  /** Fires immediately after the `workflow_runs` insert (SSE routes emit the run envelope here). */
  onRunCreated?: ({ runId }: { runId: string }) => void
  /** Invoked for each streamed graph update (running → terminal merge). */
  onNodeResult?: ({ result }: { result: NodeResult }) => void
}

export interface PersistWorkflowGraphRunResult {
  runId: string
  status: "success" | "failed"
  duration_ms: number
  error: string | null
  node_results: NodeResult[]
}

/**
 * Creates a `workflow_runs` row, walks the graph with the real step executor, updates run + workflow counters.
 */
export async function persistWorkflowGraphRun({
  supabase,
  workflowId,
  userId,
  inputs,
  workflow,
  gatewayUserAndWorkflow,
  onRunCreated,
  onNodeResult,
}: PersistWorkflowGraphRunParams): Promise<PersistWorkflowGraphRunResult> {
  const nodes = parseWorkflowNodes(workflow.nodes as unknown)
  const edges = parseWorkflowEdges(workflow.edges as unknown)

  let aggregate: NodeResult[] = []
  const startedWall = Date.now()
  let finalStatus: "success" | "failed" = "success"
  let finalError: string | null = null

  const insertRes = await supabase
    .from("workflow_runs")
    .insert({
      workflow_id: workflowId,
      status: "running",
      trigger_type: workflow.trigger_type,
      trigger_inputs: inputs as unknown as Json,
      node_results: [] as unknown as Json,
    })
    .select("id")
    .single()

  if (insertRes.error || !insertRes.data) {
    throw new Error(insertRes.error?.message ?? "Could not create run record.")
  }

  const runRowId = insertRes.data.id

  onRunCreated?.({ runId: runRowId })

  const gatewayExecutionContext: RunnerGatewayExecutionContext = {
    supabaseUserId: gatewayUserAndWorkflow.supabaseUserId,
    workflowId: gatewayUserAndWorkflow.workflowId,
    workflowRunId: runRowId,
  }

  try {
    const executeStep = createWorkflowStepExecutor()

    for await (const result of traverseWorkflowGraph({
      nodes,
      edges,
      inputs,
      executeStep,
      gatewayExecutionContext,
    })) {
      aggregate = mergeNodeResultsIntoList({ list: aggregate, next: result })
      onNodeResult?.({ result })

      if (result.status === "failed") {
        finalStatus = "failed"
        finalError =
          result.error ??
          (result.node_id === "__workflow__" ? "Workflow could not run." : "Run failed.")
      }
    }

    const duration_ms = Math.max(0, Date.now() - startedWall)
    await supabase
      .from("workflow_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        duration_ms,
        error: finalError,
        node_results: aggregate as unknown as Json,
      })
      .eq("id", runRowId)

    await supabase
      .from("workflows")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (workflow.run_count ?? 0) + 1,
      })
      .eq("id", workflowId)
      .eq("user_id", userId)

    return {
      runId: runRowId,
      status: finalStatus,
      duration_ms,
      error: finalError,
      node_results: aggregate,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected run error"
    finalStatus = "failed"
    finalError = msg
    const duration_ms = Math.max(0, Date.now() - startedWall)
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms,
        error: msg,
        node_results: aggregate as unknown as Json,
      })
      .eq("id", runRowId)
    await supabase
      .from("workflows")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (workflow.run_count ?? 0) + 1,
      })
      .eq("id", workflowId)
      .eq("user_id", userId)

    return {
      runId: runRowId,
      status: "failed",
      duration_ms,
      error: finalError,
      node_results: aggregate,
    }
  }
}
