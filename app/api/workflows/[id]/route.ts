import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  parseWorkflowEdges,
  parseWorkflowNodes,
  toPersistableEdges,
  toPersistableNodes,
} from "@/lib/workflows/engine/persist"
import {
  removeDailifyPgCronJobForWorkflowId,
  syncDailifyPgCronJobForWorkflowRow,
  WORKFLOW_CLIENT_SAFE_COLUMNS,
} from "@/lib/workflows/sync-dailify-pg-cron"
import { emitWorkflowSaveDbAuditLine } from "@/lib/workflows/workflow-save-debug-log"
import { deriveWorkflowTriggerFromRfNodes } from "@/lib/workflows/trigger/derive-workflow-trigger-from-graph"
import {
  normaliseWorkflowConstantsJson,
  workflowConstantsToJson,
} from "@/lib/workflows/workflow-constants"
import type { Json } from "@/types/database"

type PatchBody = {
  name?: string
  description?: string | null
  trigger_type?: "manual" | "webhook" | "cron"
  trigger_config?: Record<string, unknown>
  nodes?: unknown[]
  edges?: unknown[]
  status?: "active" | "inactive" | "draft"
  workflow_constants?: Record<string, unknown> | null
}

/**
 * Fetches a single workflow if it belongs to the signed-in user.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from("workflows")
    .select(WORKFLOW_CLIENT_SAFE_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ workflow: row })
}

/**
 * Updates a workflow row for the signed-in user.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.name === "string") patch.name = body.name.trim() || "Untitled workflow"
  if (body.description !== undefined) patch.description = body.description
  if (body.trigger_type !== undefined) patch.trigger_type = body.trigger_type
  if (body.trigger_config !== undefined) patch.trigger_config = body.trigger_config as Json
  if (body.status !== undefined) patch.status = body.status
  if (body.nodes !== undefined) {
    const parsedRfNodes = parseWorkflowNodes(body.nodes)
    patch.nodes = toPersistableNodes(parsedRfNodes) as unknown as Json
    const derived = deriveWorkflowTriggerFromRfNodes({ nodes: parsedRfNodes })
    patch.trigger_type = derived.trigger_type
    patch.trigger_config = derived.trigger_config as Json
  }
  if (body.edges !== undefined) {
    patch.edges = toPersistableEdges(parseWorkflowEdges(body.edges)) as unknown as Json
  }
  if (body.workflow_constants !== undefined) {
    patch.workflow_constants = workflowConstantsToJson({
      record: normaliseWorkflowConstantsJson(body.workflow_constants),
    })
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from("workflows")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(WORKFLOW_CLIENT_SAFE_COLUMNS)
    .single()

  if (error) {
    emitWorkflowSaveDbAuditLine({
      saveSource: "workflow_patch_api",
      phase: "update",
      workflowId: id,
      message: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) {
    emitWorkflowSaveDbAuditLine({
      saveSource: "workflow_patch_api",
      phase: "update",
      workflowId: id,
      message: "update returned row not found after filter",
    })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const syncCron = await syncDailifyPgCronJobForWorkflowRow({
    workflow: row,
    saveDebugSource: "workflow_patch_api",
  })
  if (!syncCron.ok) {
    return NextResponse.json({
      workflow: row,
      cron_sync_warning: syncCron.message,
    })
  }

  return NextResponse.json({ workflow: row })
}

/**
 * Deletes a workflow (and dependent runs via FK cascade).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const cronDrop = await removeDailifyPgCronJobForWorkflowId({ workflowId: id })

  const { error } = await supabase.from("workflows").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    ...(cronDrop.ok ? {} : { cron_removal_warning: cronDrop.message }),
  })
}
