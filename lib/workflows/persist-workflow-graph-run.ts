/**
 * Persists and executes a workflow graph for a runner identity — shared by the SSE run route, assistant invoke
 * tools, and privileged dispatch routes (cron, etc.).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { NodeResult } from "@/lib/workflows/engine/types"
import {
  mergeDownstreamSimulationPayload,
  mergeNodeResultsIntoList,
  resolveWorkflowPrimarySuccessorTargetId,
  traverseWorkflowGraph,
} from "@/lib/workflows/engine/runner"
import { normaliseWorkflowRunNodeResults } from "@/lib/workflows/engine/run-results"
import {
  parseWorkflowEdges,
  parseWorkflowNodes,
} from "@/lib/workflows/engine/persist"
import { createWorkflowStepExecutor } from "@/lib/workflows/engine/step-executor"
import { buildApprovedApprovalStepOutput } from "@/lib/workflows/steps/human/approval/context"
import type { RunnerGatewayExecutionContext } from "@/lib/ai-gateway/runner-gateway-tracking"
import type { Database, Json } from "@/types/database"
import { normaliseWorkflowConstantsJson } from "@/lib/workflows/workflow-constants"

/**
 * Persisted **`workflow_runs.trigger_type`** — how this invocation was dispatched (SSE test run, infra schedule,
 * webhook, etc.), distinct from **`workflows.trigger_type`** automation configuration.
 */
export type PersistWorkflowRunTrigger =
  Database["public"]["Tables"]["workflow_runs"]["Row"]["trigger_type"]

/** Display name / email captured at run start for `{{user.name}}` and `{{user.email}}`. */
export type RunnerWorkflowIdentity = {
  displayName?: string
  email?: string | null
}

export type PersistWorkflowGraphRunWorkflowRow = {
  name?: string | null
  trigger_type: string
  run_count: number | null
  nodes: unknown
  edges: unknown
  workflow_constants?: Json | null
}

export interface PersistWorkflowGraphRunParams {
  supabase: SupabaseClient
  workflowId: string
  userId: string
  inputs: Record<string, unknown>
  workflow: PersistWorkflowGraphRunWorkflowRow
  /** Stored as **`workflow_runs.trigger_type`** on the inserted run row. */
  runTrigger: PersistWorkflowRunTrigger
  /**
   * Persisted **workflows.status** at dispatch time (cron routes pass `active` when eligible).
   * Used only for infra logs when `inputs.source === "schedule"`.
   */
  workflowRowStatus?: string
  /** Attribution forwarded after the run row id is allocated (see {@link RunnerGatewayExecutionContext}). */
  gatewayUserAndWorkflow: Pick<RunnerGatewayExecutionContext, "supabaseUserId" | "workflowId">
  /** Signed-in runner display name / email surfaced as `{{user.*}}` templates (optional). */
  runnerIdentity?: RunnerWorkflowIdentity
  /** Fires immediately after the `workflow_runs` insert (SSE routes emit the run envelope here). */
  onRunCreated?: ({ runId }: { runId: string }) => void
  /** Invoked for each streamed graph update (running → terminal merge). */
  onNodeResult?: ({ result }: { result: NodeResult }) => void
}

export interface PersistWorkflowGraphRunResult {
  runId: string
  status: "success" | "failed" | "waiting_approval"
  duration_ms: number
  error: string | null
  node_results: NodeResult[]
}

export interface ResumeWorkflowGraphRunParams {
  supabase: SupabaseClient
  approvalId: string
  userId: string
  decision: "approved" | "declined"
}

export interface ResumeWorkflowGraphRunResult {
  runId: string
  status: "success" | "failed" | "waiting_approval"
  duration_ms: number
  error: string | null
  node_results: NodeResult[]
}

export interface ResumeWorkflowGraphRunFastResult {
  runId: string
  /** Immediate state after the decision is stored. */
  status: "resuming" | "failed"
  error: string | null
}

/**
 * True when this run was started by infrastructure cron / Postgres `net.http_post` (payload `source: "schedule"`).
 */
function isScheduleCronTriggerInput({ inputs }: { inputs: Record<string, unknown> }): boolean {
  return inputs.source === "schedule"
}

/**
 * One JSON line per phase so hosting log drains can filter on `workflow_schedule_trigger`.
 */
function logWorkflowScheduleTrigger({
  phase,
  workflowId,
  workflowName,
  workflowRowStatus,
  runId,
  runOutcomeStatus,
  durationMs,
  scheduleExpression,
  timezone,
  error,
}: {
  phase: "start" | "complete"
  workflowId: string
  workflowName: string | null | undefined
  workflowRowStatus?: string
  runId?: string
  runOutcomeStatus?: PersistWorkflowGraphRunResult["status"]
  durationMs?: number
  scheduleExpression?: string | null
  timezone?: string | null
  error?: string | null
}): void {
  const base: Record<string, unknown> = {
    kind: "workflow_schedule_trigger",
    phase,
    at: new Date().toISOString(),
    workflow_id: workflowId,
    workflow_name:
      typeof workflowName === "string" && workflowName.trim() !== ""
        ? workflowName.trim()
        : typeof workflowName === "string"
          ? workflowName
          : null,
  }
  if (workflowRowStatus !== undefined) {
    base.workflow_row_status = workflowRowStatus
  }
  if (runId !== undefined) {
    base.run_id = runId
  }
  if (runOutcomeStatus !== undefined) {
    base.run_outcome_status = runOutcomeStatus
  }
  if (durationMs !== undefined) {
    base.duration_ms = durationMs
  }
  if (scheduleExpression !== undefined) {
    base.schedule_expression = scheduleExpression
  }
  if (timezone !== undefined) {
    base.timezone = timezone
  }
  if (error !== undefined) {
    base.error = error
  }
  console.info(JSON.stringify(base))
}

/**
 * When traversal yields an `awaiting_approval` node and the run has not hard-failed, inserts
 * `workflow_approvals`, attaches `workflow_approval_id` on that node result, and sets the run to
 * `waiting_approval`. Used on both the initial run and after resuming past a prior approval so a
 * second (or later) approval step pauses correctly.
 */
async function persistRunPausedForApprovalIfNeeded({
  supabase,
  workflowId,
  userId,
  runRowId,
  aggregate,
  runFailed,
}: {
  supabase: SupabaseClient
  workflowId: string
  userId: string
  runRowId: string
  aggregate: NodeResult[]
  /** When true, skip — terminal failure wins over a pause. */
  runFailed: boolean
}): Promise<{ aggregate: NodeResult[]; paused: boolean }> {
  if (runFailed) {
    return { aggregate, paused: false }
  }

  const pausedOn = aggregate.find((r) => r.status === "awaiting_approval")
  if (pausedOn === undefined) {
    return { aggregate, paused: false }
  }

  const out = pausedOn.output as Record<string, unknown> | undefined
  const approvalInsertRes = await supabase
    .from("workflow_approvals")
    .insert({
      workflow_run_id: runRowId,
      workflow_id: workflowId,
      user_id: userId,
      node_id: pausedOn.node_id,
      title: typeof out?.title === "string" ? out.title : "Approval required",
      description: typeof out?.description === "string" ? out.description : null,
      reviewer_instructions:
        typeof out?.reviewerInstructions === "string" && out.reviewerInstructions.trim() !== ""
          ? out.reviewerInstructions.trim()
          : null,
      step_input: (pausedOn.input ?? {}) as Json,
      status: "pending",
    })
    .select("id")
    .single()

  if (approvalInsertRes.error || !approvalInsertRes.data) {
    throw new Error(approvalInsertRes.error?.message ?? "Could not create approval record.")
  }

  const approvalRowId = approvalInsertRes.data.id

  const nextAggregate = aggregate.map((r) =>
    r.node_id === pausedOn.node_id && r.status === "awaiting_approval"
      ? {
          ...r,
          output:
            typeof r.output === "object" &&
            r.output !== null &&
            !Array.isArray(r.output)
              ? ({
                  ...(r.output as Record<string, unknown>),
                  workflow_approval_id: approvalRowId,
                })
              : ({
                  awaiting_approval: true,
                  workflow_approval_id: approvalRowId,
                  ...(typeof out === "object" && out !== null ? out : {}),
                }),
        }
      : r,
  )

  await supabase
    .from("workflow_runs")
    .update({
      status: "waiting_approval",
      completed_at: null,
      duration_ms: null,
      error: null,
      node_results: nextAggregate as unknown as Json,
    })
    .eq("id", runRowId)

  return { aggregate: nextAggregate, paused: true }
}

/**
 * Bumps **`workflows.run_count`** and **`workflows.last_run_at`** once per new **`workflow_runs`** row —
 * invoked right after insert so cron / scheduled runs and approval-paused runs still refresh the workflow row.
 */
async function bumpWorkflowLastRunCounters(params: {
  supabase: SupabaseClient
  workflowId: string
  userId: string
  priorRunCount: number
}) {
  const { supabase, workflowId, userId, priorRunCount } = params
  await supabase
    .from("workflows")
    .update({
      last_run_at: new Date().toISOString(),
      run_count: priorRunCount + 1,
    })
    .eq("id", workflowId)
    .eq("user_id", userId)
}

/**
 * Creates a `workflow_runs` row (**and** bumps parent **`run_count`** / **`last_run_at`** immediately after insert),
 * then walks the graph with the real step executor and persists terminal run state when applicable.
 */
export async function persistWorkflowGraphRun({
  supabase,
  workflowId,
  userId,
  inputs,
  workflow,
  runTrigger,
  workflowRowStatus,
  gatewayUserAndWorkflow,
  runnerIdentity,
  onRunCreated,
  onNodeResult,
}: PersistWorkflowGraphRunParams): Promise<PersistWorkflowGraphRunResult> {
  const nodes = parseWorkflowNodes(workflow.nodes as unknown)
  const edges = parseWorkflowEdges(workflow.edges as unknown)
  const workflowConstants = normaliseWorkflowConstantsJson(workflow.workflow_constants)

  let aggregate: NodeResult[] = []
  const startedWall = Date.now()
  let finalStatus: "success" | "failed" = "success"
  let finalError: string | null = null
  const scheduledRun = isScheduleCronTriggerInput({ inputs })
  const scheduleExpressionForLog =
    typeof inputs.schedule_expression === "string" ? inputs.schedule_expression : null
  const timezoneForLog = typeof inputs.timezone === "string" ? inputs.timezone : null

  const insertRes = await supabase
    .from("workflow_runs")
    .insert({
      workflow_id: workflowId,
      status: "running",
      trigger_type: runTrigger,
      trigger_inputs: inputs as unknown as Json,
      node_results: [] as unknown as Json,
    })
    .select("id")
    .single()

  if (insertRes.error || !insertRes.data) {
    throw new Error(insertRes.error?.message ?? "Could not create run record.")
  }

  const runRowId = insertRes.data.id

  await bumpWorkflowLastRunCounters({
    supabase,
    workflowId,
    userId,
    priorRunCount: workflow.run_count ?? 0,
  })

  if (scheduledRun) {
    logWorkflowScheduleTrigger({
      phase: "start",
      workflowId,
      workflowName: workflow.name,
      workflowRowStatus,
      runId: runRowId,
      scheduleExpression: scheduleExpressionForLog,
      timezone: timezoneForLog,
    })
  }

  onRunCreated?.({ runId: runRowId })

  const gatewayExecutionContext: RunnerGatewayExecutionContext = {
    supabaseUserId: gatewayUserAndWorkflow.supabaseUserId,
    workflowId: gatewayUserAndWorkflow.workflowId,
    workflowRunId: runRowId,
    ...(typeof workflow.name === "string" && workflow.name.trim() !== ""
      ? { workflowName: workflow.name.trim() }
      : {}),
    ...(runnerIdentity?.displayName != null && String(runnerIdentity.displayName).trim() !== ""
      ? { userDisplayName: String(runnerIdentity.displayName).trim() }
      : {}),
    ...(runnerIdentity?.email != null && String(runnerIdentity.email).trim() !== ""
      ? { userEmail: String(runnerIdentity.email).trim() }
      : {}),
  }

  try {
    const executeStep = createWorkflowStepExecutor()

    for await (const result of traverseWorkflowGraph({
      nodes,
      edges,
      inputs,
      executeStep,
      gatewayExecutionContext,
      workflowConstants,
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

    /** Paused on human approval — workflow row was already bumped at run insert */
    const pauseInitial = await persistRunPausedForApprovalIfNeeded({
      supabase,
      workflowId,
      userId,
      runRowId,
      aggregate,
      runFailed: finalStatus === "failed",
    })
    if (pauseInitial.paused) {
      aggregate = pauseInitial.aggregate
      const elapsed = Math.max(0, Date.now() - startedWall)
      const out: PersistWorkflowGraphRunResult = {
        runId: runRowId,
        status: "waiting_approval",
        duration_ms: elapsed,
        error: null,
        node_results: aggregate,
      }
      if (scheduledRun) {
        logWorkflowScheduleTrigger({
          phase: "complete",
          workflowId,
          workflowName: workflow.name,
          workflowRowStatus,
          runId: runRowId,
          runOutcomeStatus: out.status,
          durationMs: out.duration_ms,
          scheduleExpression: scheduleExpressionForLog,
          timezone: timezoneForLog,
          error: out.error,
        })
      }
      return out
    }
    aggregate = pauseInitial.aggregate

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

    const out: PersistWorkflowGraphRunResult = {
      runId: runRowId,
      status: finalStatus,
      duration_ms,
      error: finalError,
      node_results: aggregate,
    }
    if (scheduledRun) {
      logWorkflowScheduleTrigger({
        phase: "complete",
        workflowId,
        workflowName: workflow.name,
        workflowRowStatus,
        runId: runRowId,
        runOutcomeStatus: out.status,
        durationMs: out.duration_ms,
        scheduleExpression: scheduleExpressionForLog,
        timezone: timezoneForLog,
        error: out.error,
      })
    }
    return out
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

    const out: PersistWorkflowGraphRunResult = {
      runId: runRowId,
      status: "failed",
      duration_ms,
      error: finalError,
      node_results: aggregate,
    }
    if (scheduledRun) {
      logWorkflowScheduleTrigger({
        phase: "complete",
        workflowId,
        workflowName: workflow.name,
        workflowRowStatus,
        runId: runRowId,
        runOutcomeStatus: out.status,
        durationMs: out.duration_ms,
        scheduleExpression: scheduleExpressionForLog,
        timezone: timezoneForLog,
        error: out.error,
      })
    }
    return out
  }
}

/**
 * Applies an inbox approval decision and either fails the run (declined), resumes traversal downstream, or
 * pauses again at a later approval step (`waiting_approval`).
 */
export async function resumeWorkflowGraphRun({
  supabase,
  approvalId,
  userId,
  decision,
}: ResumeWorkflowGraphRunParams): Promise<ResumeWorkflowGraphRunResult> {
  const { data: approval, error: approvalErr } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("user_id", userId)
    .maybeSingle()

  if (approvalErr || !approval) {
    throw new Error(approvalErr?.message ?? "Approval not found.")
  }
  if (approval.status !== "pending") {
    throw new Error("This approval has already been processed.")
  }

  const { data: run, error: runErr } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("id", approval.workflow_run_id)
    .maybeSingle()

  if (runErr || !run) {
    throw new Error(runErr?.message ?? "Run not found.")
  }

  const { data: wf, error: wfErr } = await supabase
    .from("workflows")
    .select("id, name, nodes, edges, run_count, user_id")
    .eq("id", approval.workflow_id)
    .eq("user_id", userId)
    .maybeSingle()

  if (wfErr || !wf) {
    throw new Error(wfErr?.message ?? "Workflow not found.")
  }

  const nodes = parseWorkflowNodes(wf.nodes as unknown)
  const edges = parseWorkflowEdges(wf.edges as unknown)
  const approvalNode = nodes.find((n) => n.id === approval.node_id) ?? null

  const startedWallMs = new Date(run.started_at).getTime()
  const respondedAt = new Date().toISOString()
  const stepDecisionOutput =
    decision === "approved" && approvalNode
      ? buildApprovedApprovalStepOutput({
          node: approvalNode,
          stepInput: approval.step_input as unknown,
          exe: { decision: "approved", responded_at: respondedAt },
        })
      : decision === "approved"
        ? { decision: "approved" as const, responded_at: respondedAt }
        : { decision: "declined" as const, responded_at: respondedAt }

  await supabase
    .from("workflow_approvals")
    .update({
      status: decision === "approved" ? "approved" : "declined",
      step_output: stepDecisionOutput as unknown as Json,
      responded_at: respondedAt,
      responded_by: userId,
    })
    .eq("id", approvalId)

  let aggregate = normaliseWorkflowRunNodeResults({ value: run.node_results })
  aggregate = aggregate.map((r) =>
    r.node_id === approval.node_id && r.status === "awaiting_approval"
      ? {
          ...r,
          status: "success",
          completed_at: respondedAt,
          output: stepDecisionOutput,
        }
      : r,
  )

  if (decision === "declined") {
    const duration_ms = Math.max(0, Date.now() - startedWallMs)
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms,
        error: "Approval declined",
        node_results: aggregate as unknown as Json,
      })
      .eq("id", run.id)

    return {
      runId: run.id,
      status: "failed",
      duration_ms,
      error: "Approval declined",
      node_results: aggregate,
    }
  }

  await supabase.from("workflow_runs").update({ status: "running", error: null }).eq("id", run.id)

  if (!approvalNode) {
    const duration_ms = Math.max(0, Date.now() - startedWallMs)
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms,
        error: "Approval node no longer exists in this workflow.",
        node_results: aggregate as unknown as Json,
      })
      .eq("id", run.id)

    return {
      runId: run.id,
      status: "failed",
      duration_ms,
      error: "Approval node no longer exists in this workflow.",
      node_results: aggregate,
    }
  }

  const mergedPayload = mergeDownstreamSimulationPayload({
    node: approvalNode,
    stepInput: approval.step_input as unknown,
    stepOutput: stepDecisionOutput,
  })

  const nextId = resolveWorkflowPrimarySuccessorTargetId({
    edges,
    sourceNodeId: approval.node_id,
  })

  let traverseStatus: "success" | "failed" = "success"
  let traverseError: string | null = null

  const executeStep = createWorkflowStepExecutor()

  const gatewayExecutionContext: RunnerGatewayExecutionContext = {
    supabaseUserId: userId,
    workflowId: wf.id,
    workflowRunId: run.id,
    ...(typeof wf.name === "string" && wf.name.trim() !== "" ? { workflowName: wf.name.trim() } : {}),
  }

  const resumeInputs =
    typeof run.trigger_inputs === "object" &&
    run.trigger_inputs !== null &&
    !Array.isArray(run.trigger_inputs)
      ? (run.trigger_inputs as Record<string, unknown>)
      : {}

  if (nextId) {
    for await (const result of traverseWorkflowGraph({
      nodes,
      edges,
      inputs: resumeInputs,
      executeStep,
      gatewayExecutionContext,
      resumeFrom: {
        nodeId: nextId,
        stepInput: mergedPayload,
      },
    })) {
      aggregate = mergeNodeResultsIntoList({ list: aggregate, next: result })
      if (result.status === "failed") {
        traverseStatus = "failed"
        traverseError =
          result.error ??
          (result.node_id === "__workflow__" ? "Workflow could not resume." : "Run failed.")
      }
    }
  }

  const pauseAfterResume = await persistRunPausedForApprovalIfNeeded({
    supabase,
    workflowId: wf.id,
    userId,
    runRowId: run.id,
    aggregate,
    runFailed: traverseStatus === "failed",
  })
  if (pauseAfterResume.paused) {
    const duration_ms = Math.max(0, Date.now() - startedWallMs)
    return {
      runId: run.id,
      status: "waiting_approval",
      duration_ms,
      error: null,
      node_results: pauseAfterResume.aggregate,
    }
  }
  aggregate = pauseAfterResume.aggregate

  const duration_ms = Math.max(0, Date.now() - startedWallMs)
  await supabase
    .from("workflow_runs")
    .update({
      status: traverseStatus,
      completed_at: new Date().toISOString(),
      duration_ms,
      error: traverseError,
      node_results: aggregate as unknown as Json,
    })
    .eq("id", run.id)

  return {
    runId: run.id,
    status: traverseStatus,
    duration_ms,
    error: traverseError,
    node_results: aggregate,
  }
}

/**
 * Applies an inbox decision and returns immediately for approvals.
 *
 * - **Decline**: run is marked failed synchronously (terminal). Parent workflow counters were already updated when the run was created.
 * - **Approve**: approval is stored + run is marked `running`, then traversal continues in the background and will
 *   eventually update the run row to `success`/`failed`, or `waiting_approval` when another approval step is reached.
 *
 * Note: background execution is best-effort in serverless environments.
 */
export async function resumeWorkflowGraphRunFast({
  supabase,
  approvalId,
  userId,
  decision,
}: ResumeWorkflowGraphRunParams): Promise<ResumeWorkflowGraphRunFastResult> {
  // Reuse the existing synchronous behaviour for declines (fast + terminal).
  if (decision === "declined") {
    const result = await resumeWorkflowGraphRun({ supabase, approvalId, userId, decision })
    return { runId: result.runId, status: "failed", error: result.error }
  }

  const { data: approval, error: approvalErr } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("user_id", userId)
    .maybeSingle()

  if (approvalErr || !approval) {
    throw new Error(approvalErr?.message ?? "Approval not found.")
  }
  if (approval.status !== "pending") {
    throw new Error("This approval has already been processed.")
  }

  const { data: run, error: runErr } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("id", approval.workflow_run_id)
    .maybeSingle()

  if (runErr || !run) {
    throw new Error(runErr?.message ?? "Run not found.")
  }

  const { data: wf, error: wfErr } = await supabase
    .from("workflows")
    .select("id, name, nodes, edges, run_count, user_id")
    .eq("id", approval.workflow_id)
    .eq("user_id", userId)
    .maybeSingle()

  if (wfErr || !wf) {
    throw new Error(wfErr?.message ?? "Workflow not found.")
  }

  const nodes = parseWorkflowNodes(wf.nodes as unknown)
  const edges = parseWorkflowEdges(wf.edges as unknown)
  const approvalNode = nodes.find((n) => n.id === approval.node_id) ?? null

  const respondedAt = new Date().toISOString()
  const stepDecisionOutput =
    approvalNode != null
      ? buildApprovedApprovalStepOutput({
          node: approvalNode,
          stepInput: approval.step_input as unknown,
          exe: { decision: "approved", responded_at: respondedAt },
        })
      : { decision: "approved" as const, responded_at: respondedAt }

  await supabase
    .from("workflow_approvals")
    .update({
      status: "approved",
      step_output: stepDecisionOutput as unknown as Json,
      responded_at: respondedAt,
      responded_by: userId,
    })
    .eq("id", approvalId)

  // Mark run as running immediately so the UI can move on.
  await supabase.from("workflow_runs").update({ status: "running", error: null }).eq("id", run.id)

  // Best-effort background traversal to completion.
  void (async () => {
    try {
      // If the node disappeared, fail the run (terminal).
      if (!approvalNode) {
        const startedWallMs = new Date(run.started_at).getTime()
        const aggregate = normaliseWorkflowRunNodeResults({ value: run.node_results })
        const duration_ms = Math.max(0, Date.now() - startedWallMs)
        await supabase
          .from("workflow_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            duration_ms,
            error: "Approval node no longer exists in this workflow.",
            node_results: aggregate as unknown as Json,
          })
          .eq("id", run.id)
        return
      }

      let aggregate = normaliseWorkflowRunNodeResults({ value: run.node_results })
      aggregate = aggregate.map((r) =>
        r.node_id === approval.node_id && r.status === "awaiting_approval"
          ? {
              ...r,
              status: "success",
              completed_at: respondedAt,
              output: stepDecisionOutput,
            }
          : r,
      )

      const mergedPayload = mergeDownstreamSimulationPayload({
        node: approvalNode,
        stepInput: approval.step_input as unknown,
        stepOutput: stepDecisionOutput,
      })

      const nextId = resolveWorkflowPrimarySuccessorTargetId({
        edges,
        sourceNodeId: approval.node_id,
      })

      let traverseStatus: "success" | "failed" = "success"
      let traverseError: string | null = null

      const executeStep = createWorkflowStepExecutor()
      const gatewayExecutionContext: RunnerGatewayExecutionContext = {
        supabaseUserId: userId,
        workflowId: wf.id,
        workflowRunId: run.id,
        ...(typeof wf.name === "string" && wf.name.trim() !== "" ? { workflowName: wf.name.trim() } : {}),
      }

      const resumeInputs =
        typeof run.trigger_inputs === "object" &&
        run.trigger_inputs !== null &&
        !Array.isArray(run.trigger_inputs)
          ? (run.trigger_inputs as Record<string, unknown>)
          : {}

      if (nextId) {
        for await (const result of traverseWorkflowGraph({
          nodes,
          edges,
          inputs: resumeInputs,
          executeStep,
          gatewayExecutionContext,
          resumeFrom: {
            nodeId: nextId,
            stepInput: mergedPayload,
          },
        })) {
          aggregate = mergeNodeResultsIntoList({ list: aggregate, next: result })
          if (result.status === "failed") {
            traverseStatus = "failed"
            traverseError =
              result.error ??
              (result.node_id === "__workflow__" ? "Workflow could not resume." : "Run failed.")
          }
        }
      }

      const pauseAfterResume = await persistRunPausedForApprovalIfNeeded({
        supabase,
        workflowId: wf.id,
        userId,
        runRowId: run.id,
        aggregate,
        runFailed: traverseStatus === "failed",
      })
      if (pauseAfterResume.paused) {
        return
      }
      aggregate = pauseAfterResume.aggregate

      const startedWallMs = new Date(run.started_at).getTime()
      const duration_ms = Math.max(0, Date.now() - startedWallMs)
      await supabase
        .from("workflow_runs")
        .update({
          status: traverseStatus,
          completed_at: new Date().toISOString(),
          duration_ms,
          error: traverseError,
          node_results: aggregate as unknown as Json,
        })
        .eq("id", run.id)
    } catch (err) {
      console.error("resumeWorkflowGraphRunFast(background)", err)
    }
  })()

  return { runId: run.id, status: "resuming", error: null }
}
