import { NextResponse } from "next/server"

import { persistWorkflowGraphRun } from "@/lib/workflows/persist-workflow-graph-run"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role-client"
import { isScheduleDueForTick } from "@/lib/workflows/trigger/is-schedule-due-for-tick"
import { workflowCronSharedSecretAuthFailure } from "@/lib/workflows/workflow-cron-http-auth"
import type { Json } from "@/types/database"

type WorkflowDispatchRow = {
  id: string
  user_id: string
  name: string | null
  trigger_type: string
  trigger_config: unknown
  status: string
  run_count: number | null
  nodes: unknown
  edges: unknown
  workflow_constants: unknown
}

/**
 * **Legacy bulk dispatcher** — minute tick scans every active cron workflow and applies {@link isScheduleDueForTick}.
 *
 * **Deprecated:** Prefer **`POST /api/cron/workflows/[workflowId]`** + **`dailify_add_or_replace_cron_job`**
 * (migration `supabase/migrations/*_dailify_cron_rpc.sql`) — one Postgres `cron.job` per workflow. Leaving this route
 * active **and** deploying per-workflow jobs **duplicate-runs** the same workflows — remove Vault global tick jobs /
 * callers when Per-workflow Cron is deployed.
 *
 * **Supabase Cron:** https://supabase.com/docs/guides/cron · **Headers:** `Authorization: Bearer` + **`WORKFLOW_CRON_DISPATCH_SECRET`**.
 */
export async function POST(request: Request) {
  const unauthorised = workflowCronSharedSecretAuthFailure(request)
  if (unauthorised !== null) {
    return unauthorised
  }

  let supabase
  try {
    supabase = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service client misconfiguration"
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  const tick = new Date()

  const { data: rows, error: listErr } = await supabase
    .from("workflows")
    .select(
      "id, user_id, name, trigger_type, trigger_config, status, run_count, nodes, edges, workflow_constants",
    )
    .eq("trigger_type", "cron")
    .eq("status", "active")

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 })
  }

  const dispatchList = (rows ?? []) as WorkflowDispatchRow[]

  let started = 0
  let evaluated = 0
  const failed_run_ids: string[] = []

  for (const row of dispatchList) {
    const cfg =
      row.trigger_config && typeof row.trigger_config === "object"
        ? (row.trigger_config as Record<string, unknown>)
        : {}
    const schedule = typeof cfg.schedule === "string" ? cfg.schedule : ""
    const timezone = typeof cfg.timezone === "string" && cfg.timezone.trim() !== "" ? cfg.timezone : "UTC"

    if (!isScheduleDueForTick({ expression: schedule, timezone, tick })) {
      continue
    }

    evaluated++

    const inputs = {
      source: "schedule",
      fired_at: tick.toISOString(),
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
      started++
    } catch {
      failed_run_ids.push(row.id)
    }
  }

  return NextResponse.json({
    ok: true,
    evaluated,
    started,
    failed_count: failed_run_ids.length,
    failed_workflow_ids: failed_run_ids,
  })
}
