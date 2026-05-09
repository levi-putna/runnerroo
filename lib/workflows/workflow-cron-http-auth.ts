import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

/**
 * Timing-safe comparison of an incoming **`Authorization: Bearer <token>`** header against the
 * per-workflow **`cron_dispatch_token`** stored in the database.
 *
 * Returns `null` on success; a `NextResponse` to immediately return from the handler on failure.
 *
 * @param request - Incoming HTTP request.
 * @param storedToken - Value of `workflows.cron_dispatch_token` loaded via service role (may be null / empty if never set).
 */
export function workflowCronPerWorkflowAuthFailure(
  request: Request,
  storedToken: string | null | undefined,
): NextResponse | null {
  if (!storedToken) {
    return NextResponse.json(
      { error: "This workflow does not have a cron dispatch token configured." },
      { status: 503 },
    )
  }

  const auth = request.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }
  const candidate = auth.slice("Bearer ".length).trim()

  const aBuf = Buffer.from(candidate, "utf8")
  const bBuf = Buffer.from(storedToken, "utf8")
  if (aBuf.length !== bBuf.length || !timingSafeEqual(aBuf, bBuf)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  return null
}

/**
 * Legacy shared-secret check used by the **bulk** dispatcher (`/api/cron/workflow-schedules`).
 * The per-workflow route now uses {@link workflowCronPerWorkflowAuthFailure} instead.
 *
 * Returns `null` on success; a `NextResponse` on failure.
 */
export function workflowCronSharedSecretAuthFailure(request: Request): NextResponse | null {
  const configuredSecret = process.env.WORKFLOW_CRON_DISPATCH_SECRET?.trim()
  if (!configuredSecret) {
    return NextResponse.json(
      {
        error: "Cron dispatch is not configured.",
        hint: "Set WORKFLOW_CRON_DISPATCH_SECRET for the legacy bulk route (POST /api/cron/workflow-schedules).",
      },
      { status: 503 },
    )
  }

  const auth = request.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }
  const candidate = auth.slice("Bearer ".length).trim()
  const aBuf = Buffer.from(candidate, "utf8")
  const bBuf = Buffer.from(configuredSecret, "utf8")
  if (aBuf.length !== bBuf.length || !timingSafeEqual(aBuf, bBuf)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  return null
}
