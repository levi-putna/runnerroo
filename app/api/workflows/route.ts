import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  parseWorkflowEdges,
  parseWorkflowNodes,
  toPersistableEdges,
  toPersistableNodes,
} from "@/lib/workflows/engine/persist"
import {
  syncDailifyPgCronJobForWorkflowRow,
  WORKFLOW_CLIENT_SAFE_COLUMNS,
} from "@/lib/workflows/sync-dailify-pg-cron"
import { emitWorkflowSaveDbAuditLine } from "@/lib/workflows/workflow-save-debug-log"
import { deriveWorkflowTriggerFromRfNodes } from "@/lib/workflows/trigger/derive-workflow-trigger-from-graph"
import type { Json } from "@/types/database"

type PostBody = {
  name?: string
  description?: string | null
  trigger_type?: "manual" | "webhook" | "cron"
  trigger_config?: Record<string, unknown>
  nodes?: unknown[]
  edges?: unknown[]
  status?: "active" | "inactive" | "draft"
}

/**
 * Lists the signed-in user’s workflows (newest first).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from("workflows")
    .select(
      "id, name, description, trigger_type, trigger_config, status, run_count, last_run_at, updated_at, created_at"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ workflows: rows ?? [] })
}

/**
 * Creates a workflow row for the signed-in user.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled workflow"
  const description = body.description ?? null
  const parsedRfNodes = parseWorkflowNodes(body.nodes)
  const derivedTrigger = deriveWorkflowTriggerFromRfNodes({ nodes: parsedRfNodes })
  const trigger_type = derivedTrigger.trigger_type
  const trigger_config = derivedTrigger.trigger_config as Json
  const status = body.status ?? "draft"

  const nodes = toPersistableNodes(parsedRfNodes) as unknown as Json
  const edges = toPersistableEdges(parseWorkflowEdges(body.edges)) as unknown as Json

  const { data: row, error } = await supabase
    .from("workflows")
    .insert({
      user_id: user.id,
      name,
      description,
      trigger_type,
      trigger_config,
      nodes,
      edges,
      status,
    })
    .select(WORKFLOW_CLIENT_SAFE_COLUMNS)
    .single()

  if (error) {
    emitWorkflowSaveDbAuditLine({
      saveSource: "workflow_post_api",
      phase: "create",
      message: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const syncCron = await syncDailifyPgCronJobForWorkflowRow({
    workflow: row,
    saveDebugSource: "workflow_post_api",
  })
  if (!syncCron.ok) {
    return NextResponse.json({
      workflow: row,
      cron_sync_warning: syncCron.message,
    })
  }

  return NextResponse.json({ workflow: row })
}
