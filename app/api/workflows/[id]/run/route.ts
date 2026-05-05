import {
  mergeNodeResultsIntoList,
  traverseWorkflowGraph,
} from "@/lib/workflow/runner"
import {
  parseWorkflowEdges,
  parseWorkflowNodes,
} from "@/lib/workflow/persist"
import { createClient } from "@/lib/supabase/server"
import type { NodeResult } from "@/lib/workflow/types"
import type { Json } from "@/types/database"
import { createWorkflowStepExecutor } from "@/lib/workflow/step-executor"

type RunPostBody = {
  inputs?: Record<string, unknown>
}

/**
 * Streams simulated workflow execution as Server-Sent Events (`data:` JSON lines).
 * Persists a `workflow_runs` row and updates it when the traversal finishes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: RunPostBody = {}
  try {
    body = (await request.json()) as RunPostBody
  } catch {
    body = {}
  }
  const inputs = body.inputs ?? {}

  const { data: workflow, error: wfErr } = await supabase
    .from("workflows")
    .select("id, nodes, edges, trigger_type, run_count, user_id")
    .eq("id", workflowId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (wfErr) {
    return new Response(JSON.stringify({ error: wfErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (!workflow) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const nodes = parseWorkflowNodes(workflow.nodes as unknown)
  const edges = parseWorkflowEdges(workflow.edges as unknown)

  const encoder = new TextEncoder()

  let runRowId = ""

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      let aggregate: NodeResult[] = []
      const startedWall = Date.now()
      let finalStatus: "success" | "failed" = "success"
      let finalError: string | null = null

      try {
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
          push({
            kind: "error",
            message: insertRes.error?.message ?? "Could not create run record.",
          })
          controller.close()
          return
        }

        runRowId = insertRes.data.id
        push({ kind: "run", runId: runRowId })

        const executeStep = createWorkflowStepExecutor()

        for await (const result of traverseWorkflowGraph({
          nodes,
          edges,
          inputs,
          executeStep,
          gatewayExecutionContext: {
            supabaseUserId: user.id,
            workflowId,
            workflowRunId: runRowId,
          },
        })) {
          aggregate = mergeNodeResultsIntoList({ list: aggregate, next: result })
          push({
            kind: "node_result",
            result,
          })

          if (result.status === "failed") {
            finalStatus = "failed"
            finalError =
              result.error ??
              (result.node_id === "__workflow__"
                ? "Workflow could not run."
                : "Run failed.")
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
          .eq("user_id", user.id)

        push({
          kind: "complete",
          runId: runRowId,
          status: finalStatus,
          duration_ms,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unexpected run error"
        finalStatus = "failed"
        finalError = msg
        if (runRowId) {
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
            .eq("user_id", user.id)
        }
        push({ kind: "error", message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

/**
 * Lists recent runs for a workflow owned by the signed-in user.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: wf } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", workflowId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!wf) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: runs, error } = await supabase
    .from("workflow_runs")
    .select(
      "id, workflow_id, status, started_at, completed_at, duration_ms, trigger_type, error, node_results, wdk_run_id, trigger_inputs",
    )
    .eq("workflow_id", workflowId)
    .order("started_at", { ascending: false })
    .limit(100)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ runs: runs ?? [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
