import { createClient } from "@/lib/supabase/server"
import { persistWorkflowGraphRun } from "@/lib/workflows/persist-workflow-graph-run"

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

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        const persisted = await persistWorkflowGraphRun({
          supabase,
          workflowId,
          userId: user.id,
          inputs,
          workflow,
          gatewayUserAndWorkflow: {
            supabaseUserId: user.id,
            workflowId,
          },
          onRunCreated: ({ runId }) => {
            push({ kind: "run", runId })
          },
          onNodeResult: ({ result }) => {
            push({
              kind: "node_result",
              result,
            })
          },
        })

        push({
          kind: "complete",
          runId: persisted.runId,
          status: persisted.status,
          duration_ms: persisted.duration_ms,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unexpected run error"
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
