/**
 * Supabase pg_cron integration for schedule workflows: `dailify_*` RPCs register per-workflow `cron.job` rows.
 */

import { randomBytes } from "node:crypto"

import type { Database } from "@/types/database"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role-client"
import type { Json } from "@/types/database"
import { emitWorkflowSavePgCronAuditLine } from "@/lib/workflows/workflow-save-debug-log"

// ---------------------------------------------------------------------------
// Columns that are safe to return in client-facing API responses.
// cron_dispatch_token is intentionally excluded — it must never reach the browser.
// ---------------------------------------------------------------------------
export const WORKFLOW_CLIENT_SAFE_COLUMNS =
  "id, created_at, updated_at, user_id, name, description, trigger_type, trigger_config, nodes, edges, graph_version, status, run_count, last_run_at, workflow_constants" as const

/**
 * Canonical pg_cron job name for a workflow (`dailify_wf_` prefix + hyphen-stripped UUID).
 */
export function dailifyPgCronJobNameForWorkflowId({ workflowId }: { workflowId: string }): string {
  const compact = workflowId.replace(/-/g, "")
  return `dailify_wf_${compact}`
}

/**
 * Returns `null` when the URL is safe for pg_net registration; otherwise a human-readable reason.
 *
 * ### What Supabase Cron actually does
 * Supabase Cron runs **`cron.schedule()`** whose command is **`SELECT net.http_post(...)`** — an
 * outbound HTTP request from **Postgres** (on the hosted platform that is Supabase's network; with
 * **`supabase start`** it is the local **`supabase_db_*`** container). This means:
 * - **`localhost` / `127.0.0.1`** → inside that container only, not your Mac. Always wrong for local Next.js.
 * - **`http://`** → accepted by pg_net; use **`https://`** in production.
 * - The URL must be publicly routable from Supabase's network.
 *
 * For local dev, options include:
 * - **Tunnel:** set **`WORKFLOW_CRON_PUBLIC_BASE_URL`** to an ngrok / Cloudflare Tunnel URL (matches hosted Supabase behaviour).
 * - **Docker Desktop + Next on the Mac:** set **`WORKFLOW_CRON_PUBLIC_BASE_URL`** to `http://host.docker.internal` plus your dev port
 *   (this app uses **`yarn dev` on port 80** — include `:80` only if you use it explicitly in the URL). Ensure the dev server listens on
 *   **`0.0.0.0`**, not only **127.0.0.1**, or the container cannot connect.
 * - **Same custom host as the browser (e.g. dailify.local):** the DB container must resolve that name to the host VM. After each
 *   **`supabase start`** (new Postgres container), run **`yarn sb:map-cron-host`** (see **`scripts/map-host-alias-in-supabase-db.sh`**).
 *
 * **`WORKFLOW_CRON_PUBLIC_BASE_URL`** overrides **`NEXT_PUBLIC_SITE_URL`** for cron registration only so browser-facing URLs can stay as-is.
 */
function pgNetCronDispatchUrlIssue({ absoluteWebhookUrl }: { absoluteWebhookUrl: string }): string | null {
  let parsed: URL
  try {
    parsed = new URL(absoluteWebhookUrl)
  } catch {
    return "Cron webhook URL is not a valid absolute URL. Check WORKFLOW_CRON_PUBLIC_BASE_URL or NEXT_PUBLIC_SITE_URL."
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Cron webhook URL must start with https:// or http:// (pg_net rejects other schemes)."
  }
  const host = parsed.hostname.toLowerCase()
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return (
      "Cron webhook URL points to localhost — pg_cron / pg_net runs inside the Postgres container and 127.0.0.1 there is not your Mac. " +
      "Options: (1) deployed origin via WORKFLOW_CRON_PUBLIC_BASE_URL, (2) local Docker Desktop: http://host.docker.internal with your dev port, " +
      "(3) tunnel URL, or (4) custom host: run yarn sb:map-cron-host after supabase start and keep using http://dailify.local (or your alias)."
    )
  }
  return null
}

/**
 * Normalises the base URL env value — adds `https://` when no scheme is present (bare hostname),
 * strips trailing slashes.
 */
function normaliseWorkflowCronHookBase({ raw }: { raw: string }): string | null {
  const collapsed = raw.trim().replace(/\/+$/, "")
  if (collapsed === "") return null

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(collapsed)
    ? collapsed
    : `https://${collapsed.replace(/^\/+/, "")}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }
  if (parsed.hostname === "") return null

  let pathname = parsed.pathname.replace(/\/+$/, "")
  if (pathname === "/") pathname = ""

  return `${parsed.protocol}//${parsed.host}${pathname}`
}

/**
 * Resolves the base origin for pg_net cron dispatch.
 * Prefers **`WORKFLOW_CRON_PUBLIC_BASE_URL`** over **`NEXT_PUBLIC_SITE_URL`** so you can keep
 * the browser dev server at localhost while pointing cron at a tunnel or staging URL.
 */
function workflowCronHookPublicBase(): string | null {
  const raw =
    process.env.WORKFLOW_CRON_PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || ""
  return normaliseWorkflowCronHookBase({ raw })
}

/** Row slice needed to sync `cron.job` after writes. */
export type WorkflowCronSyncRow = Pick<
  Database["public"]["Tables"]["workflows"]["Row"],
  "id" | "trigger_type" | "status" | "trigger_config"
>

/**
 * Registers or updates a **`cron.job`** row for a schedule workflow, or removes it when the
 * workflow is no longer eligible (trigger not cron / status not active / no schedule).
 *
 * ### How it works
 * Uses **`cron.schedule()`** (upsert by job name) whose command is:
 * ```sql
 * SELECT net.http_post(
 *   url     := 'https://<host>/api/cron/workflows/<id>',
 *   headers := '{"Content-Type":"application/json","Authorization":"Bearer <per-workflow-token>"}',
 *   body    := '{}',
 *   timeout_milliseconds := 10000
 * );
 * ```
 * This is the standard Supabase pattern for calling an external endpoint from a cron job
 * (documented in pg_net + Supabase Cron quickstart).
 *
 * ### Per-workflow token
 * A fresh 32-byte hex token is generated on every call and written to
 * `workflows.cron_dispatch_token` (service role). The same token is embedded in the cron
 * command. The route handler reads the stored token back via service role and compares with
 * timing-safe equality — the token is never returned in client-facing API responses.
 *
 * Requires **`WORKFLOW_CRON_PUBLIC_BASE_URL`** (or **`NEXT_PUBLIC_SITE_URL`**) to be set to a
 * publicly routable HTTPS origin — Supabase pg_net cannot reach localhost.
 *
 * Call only server-side — requires `SUPABASE_SERVICE_ROLE_KEY`.
 */
export async function syncDailifyPgCronJobForWorkflowRow(params: {
  workflow: WorkflowCronSyncRow
  /** Echoed in `workflow_save_debug` logs for tracing. */
  saveDebugSource?: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { workflow, saveDebugSource } = params
  const jobName = dailifyPgCronJobNameForWorkflowId({ workflowId: workflow.id })
  const scheduleRaw = readScheduleFromTriggerConfig({ trigger_config: workflow.trigger_config })
  const scheduleNonempty = scheduleRaw.trim() !== ""

  const shouldSchedule =
    workflow.trigger_type === "cron" && workflow.status === "active" && scheduleNonempty

  const dispatchSecretEnvSet = Boolean(
    process.env.WORKFLOW_CRON_PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim(),
  )

  // ---------- helpers for audit log ----------------------------------------
  const emitAudit = ({ syncOk, syncMessage }: { syncOk: boolean; syncMessage?: string | null }): void => {
    const norm = workflowCronHookPublicBase()
    let webhookTargetHostname: string | null = null
    if (norm) {
      try {
        webhookTargetHostname = new URL(`${norm}/api/cron/workflows/${workflow.id}`).hostname
      } catch {
        /* ignore */
      }
    }
    emitWorkflowSavePgCronAuditLine({
      ...(saveDebugSource !== undefined ? { saveSource: saveDebugSource } : {}),
      workflowId: workflow.id,
      workflowTriggerType: workflow.trigger_type,
      workflowStatus: workflow.status,
      scheduleNonempty,
      shouldSchedule,
      jobName,
      dispatchSecretEnvSet,
      publicOriginRawEnvNonempty: dispatchSecretEnvSet,
      normalisedOrigin: norm,
      webhookTargetHostname,
      syncOk,
      ...(syncOk ? {} : { syncMessage: syncMessage ?? null }),
    })
  }
  // -------------------------------------------------------------------------

  let supabase
  try {
    supabase = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service role client unavailable"
    emitAudit({ syncOk: false, syncMessage: msg })
    return { ok: false, message: msg }
  }

  // Remove cron job when no longer eligible (and clear stored token).
  if (!shouldSchedule) {
    const { error } = await supabase.rpc("dailify_remove_cron_job", { p_job_name: jobName })
    if (error) {
      emitAudit({ syncOk: false, syncMessage: error.message })
      return { ok: false, message: error.message }
    }
    // Clear the token — it is no longer valid once the job is removed.
    await supabase
      .from("workflows")
      .update({ cron_dispatch_token: null })
      .eq("id", workflow.id)
    emitAudit({ syncOk: true })
    return { ok: true }
  }

  // ---------- validate base URL -------------------------------------------
  const baseEnvRaw =
    process.env.WORKFLOW_CRON_PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || ""
  if (baseEnvRaw === "") {
    const message =
      "Neither WORKFLOW_CRON_PUBLIC_BASE_URL nor NEXT_PUBLIC_SITE_URL is set. " +
      "Set WORKFLOW_CRON_PUBLIC_BASE_URL to your deployed origin so Supabase pg_net can reach your app."
    emitAudit({ syncOk: false, syncMessage: message })
    return { ok: false, message }
  }

  const base = workflowCronHookPublicBase()
  if (!base) {
    const message =
      `Could not parse a valid URL from "${baseEnvRaw}". ` +
      "Use a full https origin like https://your-app.vercel.app or a bare hostname."
    emitAudit({ syncOk: false, syncMessage: message })
    return { ok: false, message }
  }

  const hookUrl = `${base}/api/cron/workflows/${workflow.id}`
  const urlIssue = pgNetCronDispatchUrlIssue({ absoluteWebhookUrl: hookUrl })
  if (urlIssue !== null) {
    emitAudit({ syncOk: false, syncMessage: urlIssue })
    return { ok: false, message: urlIssue }
  }
  // -------------------------------------------------------------------------

  // Generate a fresh per-workflow token (rotates on every save of an active cron workflow).
  const dispatchToken = randomBytes(32).toString("hex")

  // Persist the token before calling the RPC so the route handler can always validate it.
  const { error: tokenWriteErr } = await supabase
    .from("workflows")
    .update({ cron_dispatch_token: dispatchToken })
    .eq("id", workflow.id)

  if (tokenWriteErr) {
    const message = `Failed to persist cron_dispatch_token: ${tokenWriteErr.message}`
    emitAudit({ syncOk: false, syncMessage: message })
    return { ok: false, message }
  }

  // Register (or replace) the pg_cron job.
  // cron.schedule() is an upsert keyed on job name so re-saving a workflow replaces the old job.
  const { error: rpcErr } = await supabase.rpc("dailify_add_or_replace_cron_job", {
    p_job_name: jobName,
    p_schedule: scheduleRaw.trim(),
    p_url: hookUrl,
    p_bearer_secret: dispatchToken,
  })

  if (rpcErr) {
    // Roll back token — no valid job uses it now.
    await supabase.from("workflows").update({ cron_dispatch_token: null }).eq("id", workflow.id)
    emitAudit({ syncOk: false, syncMessage: rpcErr.message })
    return { ok: false, message: rpcErr.message }
  }

  emitAudit({ syncOk: true })
  return { ok: true }
}

/**
 * Idempotent teardown before a workflow is deleted.
 * Removes the pg_cron job and clears the stored token.
 */
export async function removeDailifyPgCronJobForWorkflowId(params: {
  workflowId: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let supabase
  try {
    supabase = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service role client unavailable"
    return { ok: false, message: msg }
  }

  const jobName = dailifyPgCronJobNameForWorkflowId({ workflowId: params.workflowId })
  const { error } = await supabase.rpc("dailify_remove_cron_job", { p_job_name: jobName })
  if (error) {
    return { ok: false, message: error.message }
  }

  await supabase.from("workflows").update({ cron_dispatch_token: null }).eq("id", params.workflowId)

  return { ok: true }
}

function readScheduleFromTriggerConfig({ trigger_config }: { trigger_config: Json }): string {
  if (!trigger_config || typeof trigger_config !== "object") return ""
  const rec = trigger_config as Record<string, unknown>
  return typeof rec.schedule === "string" ? rec.schedule : ""
}
