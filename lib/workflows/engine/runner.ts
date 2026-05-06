import type { Edge, Node } from "@xyflow/react"
import type { RunnerGatewayExecutionContext } from "@/lib/ai-gateway/runner-gateway-tracking"
import { RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY } from "@/lib/ai-gateway/runner-gateway-tracking"
import {
  planDecisionGate,
  planSwitchGate,
  type WorkflowGatePlan,
} from "@/lib/workflows/engine/evaluate-workflow-gate-expression"
import { isApprovalRequiredError } from "@/lib/workflows/engine/approval-required-error"
import type { NodeResult } from "@/lib/workflows/engine/types"

export type { RunnerGatewayExecutionContext }

/**
 * Optional callback for real step execution.
 * When provided it is called instead of the built-in simulated output for non-structural node types.
 * Should return the step output object or throw on failure.
 */
export type StepExecutorFn = (params: {
  node: Node
  stepInput: unknown
}) => Promise<unknown>

/** Parameters for traversing and simulating a workflow graph. */
export interface TraverseWorkflowGraphParams {
  nodes: Node[]
  edges: Edge[]
  /** Resolved invoke-trigger payload (matches entry `inputSchema` keys). */
  inputs: Record<string, unknown>
  /** Inclusive milliseconds range for simulated per-step latency. */
  stepDelayMs?: { min: number; max: number }
  /**
   * Optional real step executor. When provided, replaces the built-in simulated output with the
   * actual result returned by this function. The sleep delay is skipped when a real executor is used.
   */
  executeStep?: StepExecutorFn
  /** When set, forwards Gateway attribution (`user` + `workflow_run` tags) on every downstream envelope. */
  gatewayExecutionContext?: RunnerGatewayExecutionContext
  /**
   * Continue a paused run from `nodeId` with the given inbound payload — skips entry resolution and
   * does not replay upstream steps.
   */
  resumeFrom?: { nodeId: string; stepInput: unknown }
}

/** Default simulated step delay (~300–800 ms). */
const DEFAULT_STEP_DELAY_MS = { min: 300, max: 800 }

function delayMsBetween({ min, max }: { min: number; max: number }) {
  return Math.floor(min + Math.random() * Math.max(0, max - min))
}

async function sleepMs(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normaliseHandle(handle: string | null | undefined) {
  return handle ?? "__default"
}

/**
 * Finds the canonical entry node (`type === "entry"`); prefers lexicographically smallest id when several exist.
 */
export function resolveWorkflowEntryNodeId({ nodes }: { nodes: Node[] }): string | null {
  const ids = nodes.filter((n) => n.type === "entry").map((n) => n.id)
  if (ids.length === 0) return null
  ids.sort((a, b) => a.localeCompare(b))
  return ids[0] ?? null
}

/** Builds outbound adjacency keyed by normalised source handle (`__default` when unspecified). */
function buildOutboundIndex({ edges }: { edges: Edge[] }) {
  const map = new Map<string, Edge[]>()
  for (const e of edges) {
    const key = `${e.source}::${normaliseHandle(e.sourceHandle ?? undefined)}`
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }
  /** All edges leaving `source`, any handle */
  function allFromSource(source: string): Edge[] {
    const prefix = `${source}::`
    const out: Edge[] = []
    for (const [k, list] of map) {
      if (k.startsWith(prefix)) out.push(...list)
    }
    return out
  }
  /** First edge matching handle, else any from source */
  function pickFromSource(source: string, handle: string): Edge | null {
    const exact = map.get(`${source}::${handle}`)?.[0] ?? null
    if (exact) return exact
    return allFromSource(source)[0] ?? null
  }
  /** Ordered list from source (handles split / stable ordering). */
  function allFromSourceSorted(source: string): Edge[] {
    return allFromSource(source).slice().sort((a, b) => {
      const ha = normaliseHandle(a.sourceHandle ?? undefined)
      const hb = normaliseHandle(b.sourceHandle ?? undefined)
      if (ha !== hb) return ha.localeCompare(hb)
      return a.target.localeCompare(b.target)
    })
  }
  return { allFromSource, pickFromSource, allFromSourceSorted }
}

type OutboundIndex = ReturnType<typeof buildOutboundIndex>

/**
 * Resolves the primary default successor for serial steps (entry, action, approval, AI, code, etc.).
 */
function pickPrimarySuccessorTargetId({ idx, sourceId }: { idx: OutboundIndex; sourceId: string }): string | null {
  const outgoingAll = idx.allFromSourceSorted(sourceId)
  if (outgoingAll.length === 0) return null
  const primary =
    idx.pickFromSource(sourceId, "__default") ??
    outgoingAll.find((e) => normaliseHandle(e.sourceHandle ?? undefined) === "__default") ??
    outgoingAll[0] ??
    null
  return primary?.target ?? null
}

/**
 * Public helper for suspend/resume flows — matches the single-exit edge choice in `traverseWorkflowGraph`.
 */
export function resolveWorkflowPrimarySuccessorTargetId({
  edges,
  sourceNodeId,
}: {
  edges: Edge[]
  sourceNodeId: string
}): string | null {
  const idx = buildOutboundIndex({ edges })
  return pickPrimarySuccessorTargetId({ idx, sourceId: sourceNodeId })
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * Copies execution payloads safely for branching (split) so paths do not mutate a shared reference.
 */
function cloneExecutionPayload(payload: unknown): unknown {
  if (payload === undefined) return undefined
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(payload)
    }
  } catch {
    /* fall through — e.g. non-cloneables */
  }
  try {
    return JSON.parse(JSON.stringify(payload)) as unknown
  } catch {
    return payload
  }
}

const RUNNER_EXECUTION_MARKER = "__runnerroo_execution" as const

/**
 * Reads the `globals` object from a step output when present (plain object only).
 */
function readGlobalsMapFromStepOutput({ stepOutput }: { stepOutput: unknown }): Record<string, unknown> {
  if (typeof stepOutput !== "object" || stepOutput === null) return {}
  const g = (stepOutput as Record<string, unknown>).globals
  if (g && typeof g === "object" && !Array.isArray(g)) return { ...(g as Record<string, unknown>) }
  return {}
}

/**
 * Returns accumulated workflow globals from a runner execution envelope carried on `stepInput`.
 * Used by the step executor for `{{global.*}}` resolution. Convergent merges: first visitor only
 * (see `traverseWorkflowGraph` visited set); later paths do not re-merge globals into the same node.
 */
export function readGlobalsFromExecutionStepInput({ stepInput }: { stepInput: unknown }): Record<string, unknown> {
  if (typeof stepInput !== "object" || stepInput === null) return {}
  const e = stepInput as Record<string, unknown>
  if (e[RUNNER_EXECUTION_MARKER] !== true) return {}
  const g = e.globals
  if (g && typeof g === "object" && !Array.isArray(g)) return { ...(g as Record<string, unknown>) }
  return {}
}

/**
 * Reads the immediate predecessor node id from a runner execution envelope carried on `stepInput`,
 * if present (every step after the entry receives this from {@link mergeDownstreamSimulationPayload}).
 */
export function readPredecessorNodeIdFromRunStepInput({ stepInput }: { stepInput: unknown }): string | null {
  if (typeof stepInput !== "object" || stepInput === null) return null
  const e = stepInput as Record<string, unknown>
  if (e[RUNNER_EXECUTION_MARKER] !== true) return null
  const pred = e.predecessor
  if (!pred || typeof pred !== "object") return null
  const id = (pred as Record<string, unknown>).node_id
  return typeof id === "string" && id.trim() !== "" ? id : null
}

/**
 * Wraps invoke-trigger REST payloads so successors can distinguish trigger data from envelopes.
 */
function wrapInitialInvokeTriggerPayload({
  inputs,
  gatewayExecutionContext,
}: {
  inputs: Record<string, unknown>
  gatewayExecutionContext?: RunnerGatewayExecutionContext
}): Record<string, unknown> {
  return {
    [RUNNER_EXECUTION_MARKER]: true,
    trigger_inputs: cloneExecutionPayload(inputs),
    globals: {},
    ...(gatewayExecutionContext
      ? { [RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY]: gatewayExecutionContext }
      : {}),
  }
}

/**
 * Carry-forward envelope: keeps original trigger_inputs, shallow-merged workflow globals, and predecessor step I/O for the next hop.
 */
export function mergeDownstreamSimulationPayload({
  node,
  stepInput,
  stepOutput,
}: {
  node: Node
  stepInput: unknown
  stepOutput: unknown
}): Record<string, unknown> {
  let triggerEnvelope: unknown = stepInput
  if (
    typeof stepInput === "object" &&
    stepInput !== null &&
    (stepInput as Record<string, unknown>)[RUNNER_EXECUTION_MARKER] === true
  ) {
    triggerEnvelope = (stepInput as Record<string, unknown>).trigger_inputs
  }

  const priorGlobals = readGlobalsFromExecutionStepInput({ stepInput })
  const emittedGlobals = readGlobalsMapFromStepOutput({ stepOutput })
  const mergedGlobals = { ...priorGlobals, ...emittedGlobals }

  const inheritedGateway =
    typeof stepInput === "object" &&
    stepInput !== null &&
    RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY in stepInput
      ? (stepInput as Record<string, unknown>)[RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY]
      : undefined

  return {
    [RUNNER_EXECUTION_MARKER]: true,
    trigger_inputs: cloneExecutionPayload(triggerEnvelope),
    globals: cloneExecutionPayload(mergedGlobals) as Record<string, unknown>,
    predecessor: {
      node_id: node.id,
      type: typeof node.type === "string" ? node.type : "unknown",
      step_input_received: cloneExecutionPayload(stepInput),
      step_output_emitted: cloneExecutionPayload(stepOutput),
    },
    ...(inheritedGateway !== undefined
      ? { [RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY]: inheritedGateway }
      : {}),
  }
}

/**
 * Async generator that walks the graph from the entry node, yielding {@link NodeResult}
 * updates (`running` then terminal status) for observability on the client.
 *
 * Branching: decision evaluates `data.condition`; switch evaluates case conditions top to bottom;
 * split → each outbound path
 * sequentially. Convergent merges skip re‑execution via a visited set.
 *
 * Stops when: `end` node, no outgoing edges, unknown node id, or an error is thrown inside a step.
 */
export async function* traverseWorkflowGraph({
  nodes,
  edges,
  inputs,
  stepDelayMs = DEFAULT_STEP_DELAY_MS,
  executeStep,
  gatewayExecutionContext,
  resumeFrom,
}: TraverseWorkflowGraphParams): AsyncGenerator<NodeResult> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const idx = buildOutboundIndex({ edges })
  const visited = new Set<string>()

  async function* runFrom(currentId: string, stepInput: unknown): AsyncGenerator<NodeResult> {
    /** Convergence: do not re‑execute merged nodes nor walk their outbound edges again. */
    if (visited.has(currentId)) {
      return
    }

    const node = nodeById.get(currentId)
    if (!node) {
      yield {
        node_id: currentId,
        status: "failed",
        started_at: nowIso(),
        completed_at: nowIso(),
        input: stepInput,
        error: "Unknown node id in graph.",
      }
      throw new Error(`Unknown node: ${currentId}`)
    }

    visited.add(currentId)
    const started_at = nowIso()

    yield {
      node_id: currentId,
      status: "running",
      started_at,
      input: stepInput,
    }

    let stepOutput: unknown
    let stepError: string | undefined

    if (executeStep) {
      // Real execution path — no artificial delay
      try {
        stepOutput = await executeStep({ node, stepInput })
      } catch (err) {
        if (isApprovalRequiredError(err)) {
          const paused: NodeResult = {
            node_id: currentId,
            status: "awaiting_approval",
            started_at,
            completed_at: nowIso(),
            input: stepInput,
            output: {
              awaiting_approval: true,
              title: err.title,
              description: err.description,
              reviewerInstructions: err.reviewerInstructions,
            },
          }
          yield paused
          /** Stop traversal without treating this branch as failure */
          return
        }
        stepError = err instanceof Error ? err.message : String(err)
      }
    } else {
      // Simulated execution path
      await sleepMs(delayMsBetween(stepDelayMs))
      stepOutput = buildSimulatedStepOutput({ node })
    }

    const nodeType = typeof node.type === "string" ? node.type : ""

    let gateRoute: WorkflowGatePlan = { kind: "none" }

    if (stepError === undefined && nodeType === "decision") {
      const planned = planDecisionGate({ node, stepInput })
      if (!planned.ok) {
        stepError = planned.error
      } else {
        gateRoute = planned.plan
      }
    }

    if (stepError === undefined && nodeType === "switch") {
      const planned = planSwitchGate({ node, stepInput })
      if (!planned.ok) {
        stepError = planned.error
      } else {
        gateRoute = planned.plan
      }
    }

    if (stepError !== undefined) {
      const failed: NodeResult = {
        node_id: currentId,
        status: "failed",
        started_at,
        completed_at: nowIso(),
        input: stepInput,
        error: stepError,
      }
      yield failed
      throw new Error(stepError)
    }

    const terminal: NodeResult = {
      node_id: currentId,
      status: "success",
      started_at,
      completed_at: nowIso(),
      input: stepInput,
      output: stepOutput,
    }
    yield terminal

    /** Pass-through object so downstream reads both trigger data and simulated step envelopes */
    const mergedDownstreamPayload = mergeDownstreamSimulationPayload({
      node,
      stepInput,
      stepOutput,
    })

    const t = nodeType

    /** Graph sink — stop traversing */
    if (t === "end") {
      return
    }

    const outgoingAll = idx.allFromSourceSorted(currentId)

    if (outgoingAll.length === 0) {
      /** Dead end — not an error */
      return
    }

    if (t === "decision") {
      const truthy = gateRoute.kind === "decision" ? gateRoute.truthy : false
      const handle = truthy ? "true" : "false"
      const picked =
        idx.pickFromSource(currentId, handle) ??
        idx.pickFromSource(currentId, "__default") ??
        outgoingAll[0] ??
        null
      if (!picked) return
      yield* runFrom(picked.target, cloneExecutionPayload(mergedDownstreamPayload))
      return
    }

    if (t === "switch") {
      const caseId = gateRoute.kind === "switch" ? gateRoute.caseId : null
      let picked: Edge | null = null
      if (caseId) {
        picked = idx.pickFromSource(currentId, `case-${caseId}`)
      }
      if (!picked) {
        picked =
          idx.pickFromSource(currentId, "default") ??
          idx.pickFromSource(currentId, "__default") ??
          null
      }
      if (!picked && outgoingAll.length > 0) {
        picked =
          outgoingAll.find((e) => normaliseHandle(e.sourceHandle ?? undefined).startsWith("case-")) ??
          outgoingAll[0] ??
          null
      }
      if (!picked) return
      yield* runFrom(picked.target, cloneExecutionPayload(mergedDownstreamPayload))
      return
    }

    if (t === "split") {
      for (const e of outgoingAll) {
        yield* runFrom(e.target, cloneExecutionPayload(mergedDownstreamPayload))
      }
      return
    }

    /** Single primary exit (entry, action, ai, approval, code, etc.) — one outbound edge expected */
    const nextId = pickPrimarySuccessorTargetId({ idx, sourceId: currentId })
    if (!nextId) return
    yield* runFrom(nextId, cloneExecutionPayload(mergedDownstreamPayload))
  }

  if (resumeFrom) {
    try {
      yield* runFrom(resumeFrom.nodeId, resumeFrom.stepInput)
    } catch {
      /** Failure already yielded from generator */
    }
    return
  }

  const entryId = resolveWorkflowEntryNodeId({ nodes })
  if (!entryId) {
    const started_at = nowIso()
    yield {
      node_id: "__workflow__",
      status: "failed",
      started_at,
      completed_at: nowIso(),
      error: "This workflow has no entry node.",
    }
    return
  }

  try {
    yield* runFrom(
      entryId,
      wrapInitialInvokeTriggerPayload({ inputs, gatewayExecutionContext }),
    )
  } catch {
    /** Failure already yielded from generator */
  }
}

/**
 * Lightweight simulated output emitted to the next downstream step (`stepInput`).
 */
function buildSimulatedStepOutput({ node }: { node: Node }): unknown {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  if (node.type === "entry") {
    return { kind: "entry_output", label, ok: true }
  }
  if (node.type === "end") {
    return { success: true }
  }
  return {
    kind: node.type ?? "step_output",
    node_id: node.id,
    label,
    ok: true,
  }
}

/**
 * Accumulates streamed {@link NodeResult} rows into an array suitable for `workflow_runs.node_results`,
 * merging running + terminal updates per `node_id` (terminal wins).
 */
export function mergeNodeResultsIntoList({
  list,
  next,
}: {
  list: NodeResult[]
  next: NodeResult
}): NodeResult[] {
  const i = list.findIndex((r) => r.node_id === next.node_id)
  if (i === -1) {
    return [...list, next]
  }
  const copy = [...list]
  copy[i] = mergeNodeResult({ prev: copy[i], next })
  return copy
}

/** Merges a follow-up status for the same node (e.g. running → success). */
export function mergeNodeResult({ prev, next }: { prev: NodeResult; next: NodeResult }): NodeResult {
  const hasNextInput = Object.prototype.hasOwnProperty.call(next, "input")
  const hasNextOutput = Object.prototype.hasOwnProperty.call(next, "output")
  return {
    ...prev,
    ...next,
    started_at: prev.started_at ?? next.started_at,
    completed_at: next.completed_at ?? prev.completed_at,
    status: next.status,
    input: hasNextInput ? next.input : prev.input,
    output: hasNextOutput ? next.output : prev.output,
    error: next.error ?? prev.error,
  }
}
