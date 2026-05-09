import { NextResponse } from "next/server"

import { persistWorkflowGraphRun } from "@/lib/workflows/persist-workflow-graph-run"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role-client"
import { workflowCronPerWorkflowAuthFailure } from "@/lib/workflows/workflow-cron-http-auth"
import type { Json } from "@/types/database"

/**
 * **Per-workflow Supabase Cron hook.**
 *
 * Postgres `pg_cron` + `pg_net` calls this endpoint on the workflow's cron cadence via
 * `dailify_add_or_replace_cron_job`. The request carries:
 *   `Authorization: Bearer <cron_dispatch_token>`
 *
 * The token is unique per workflow, generated in Node.js (randomBytes(32)) when the cron job is
 * registered, stored in `workflows.cron_dispatch_token`, and embedded in the pg_cron command.
 * It is never returned in client-facing API responses.
 */
export async function POST(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params

  let supabase
  try {
    supabase = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service client misconfiguration"
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  // Load the workflow including cron_dispatch_token — service role bypasses RLS.
  const { data: row, error: fetchErr } = await supabase
    .from("workflows")
    .select(
      "id, user_id, name, trigger_type, trigger_config, status, run_count, nodes, edges, cron_dispatch_token, workflow_constants",
    )
    .eq("id", workflowId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Validate the per-workflow token from the Authorization header.
  const authFailure = workflowCronPerWorkflowAuthFailure(request, row.cron_dispatch_token)
  if (authFailure !== null) {
    return authFailure
  }

  if (row.trigger_type !== "cron" || row.status !== "active") {
    return NextResponse.json({ error: "Workflow is not eligible for cron dispatch." }, { status: 404 })
  }

  const cfg =
    row.trigger_config && typeof row.trigger_config === "object"
      ? (row.trigger_config as Record<string, unknown>)
      : {}
  const schedule = typeof cfg.schedule === "string" ? cfg.schedule : ""
  const timezone = typeof cfg.timezone === "string" && cfg.timezone.trim() !== "" ? cfg.timezone : "UTC"

  const inputs = {
    source: "schedule",
    fired_at: new Date().toISOString(),
    schedule_expression: schedule,
    timezone,
  }

  try {
    await persistWorkflowGraphRun({
      supabase,
      workflowId: row.id,
      userId: row.user_id,
      inputs,
      runTrigger: "cron",
      workflowRowStatus: row.status,
      workflow: {
        name: row.name,
        trigger_type: row.trigger_type,
        run_count: row.run_count ?? 0,
        nodes: row.nodes,
        edges: row.edges,
          workflow_constants: row.workflow_constants as Json,
      },
      gatewayUserAndWorkflow: {
        supabaseUserId: row.user_id,
        workflowId: row.id,
      },
      runnerIdentity: {
        displayName: "Scheduled workflow",
        email: null,
      },
    })
    return NextResponse.json({ ok: true, workflow_id: row.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Run failed."
    console.error(
      JSON.stringify({
        kind: "workflow_cron_dispatch_error",
        workflow_id: row.id,
        at: new Date().toISOString(),
        error: msg,
      }),
    )
    return NextResponse.json({ error: "Run failed." }, { status: 500 })
  }
}
