/**
 * One JSON line per event so production logs (**Vercel**, etc.) remain greppable (**`workflow_save_debug`**).
 */

/**
 * Describes **`dailify_*`** pg_cron registration after a **`workflows`** row is written.
 *
 * Avoids bearer secrets — only booleans / hostnames for dispatch diagnosis.
 */
export function emitWorkflowSavePgCronAuditLine({
  saveSource,
  workflowId,
  workflowTriggerType,
  workflowStatus,
  scheduleNonempty,
  shouldSchedule,
  jobName,
  dispatchSecretEnvSet,
  publicOriginRawEnvNonempty,
  normalisedOrigin,
  webhookTargetHostname,
  syncOk,
  syncMessage,
}: {
  /** Where the sync was kicked off (**`workflow_post`**, **`workflow_patch`**, etc.). */
  saveSource?: string
  workflowId: string
  workflowTriggerType: string
  workflowStatus: string
  scheduleNonempty: boolean
  /** True when **`trigger_type`**, **`active`**, and non-empty **`schedule`** would register Cron. */
  shouldSchedule: boolean
  /** Dailify **`pg_cron`** job name (stable from workflow id). */
  jobName: string
  dispatchSecretEnvSet: boolean
  publicOriginRawEnvNonempty: boolean
  /** Resolved base URL (**`/`**-trimmed origin + optional path prefix) or **`null`**. */
  normalisedOrigin: string | null
  /** Parsed hostname for **`POST /api/cron/workflows/[id]`** when known; **`null`** if not computed yet or invalid. */
  webhookTargetHostname: string | null
  syncOk: boolean
  /** Populated only when **`syncOk`** is **`false`** (matches **`cron_sync_warning`** text). */
  syncMessage?: string | null
}): void {
  const payload: Record<string, unknown> = {
    kind: "workflow_save_debug",
    subtype: "pg_cron_after_save",
    at: new Date().toISOString(),
    ...(saveSource !== undefined ? { save_source: saveSource } : {}),
    workflow_id: workflowId,
    workflow_trigger_type: workflowTriggerType,
    workflow_status: workflowStatus,
    schedule_nonempty: scheduleNonempty,
    dailify_pg_cron_would_schedule: shouldSchedule,
    dailify_pg_cron_job_name: jobName,
    env_workflow_dispatch_secret_set: dispatchSecretEnvSet,
    env_cron_public_base_raw_nonempty: publicOriginRawEnvNonempty,
    normalised_dispatch_origin: normalisedOrigin,
    webhook_target_hostname: webhookTargetHostname,
    sync_ok: syncOk,
  }
  if (!syncOk) {
    payload.sync_message = syncMessage != null && syncMessage !== "" ? syncMessage : "sync failed without message"
  }
  const encoded = JSON.stringify(payload)
  if (syncOk) {
    console.info(encoded)
    return
  }
  console.warn(encoded)
}

/**
 * Database layer failed before **`pg_cron`** sync (**`workflow` row** insert/update).
 */
export function emitWorkflowSaveDbAuditLine({
  saveSource,
  phase,
  workflowId,
  message,
}: {
  saveSource: string
  phase: "create" | "update"
  workflowId?: string | null
  message: string
}): void {
  console.warn(
    JSON.stringify({
      kind: "workflow_save_debug",
      subtype: `workflow_${phase}_db_error`,
      at: new Date().toISOString(),
      save_source: saveSource,
      ...(workflowId != null ? { workflow_id: workflowId } : {}),
      message,
    }),
  )
}
