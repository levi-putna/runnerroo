/** Stable formatter so SSR and the browser produce identical strings (avoids hydration mismatches). */
const runLocalDateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/**
 * Formats an ISO timestamp for display in run history UIs.
 * Uses fixed `en-AU` and 24-hour time so Node SSR and the browser agree (hydration-safe).
 */
export function formatRunLocalDate(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.valueOf())) return iso
    return runLocalDateFormatter.format(d)
  } catch {
    return iso
  }
}

/**
 * Human-readable duration from stored milliseconds (or in-flight placeholder).
 */
export function displayRunDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "Running…"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(ms < 5000 ? 2 : 1)} s`
}

type WorkflowRunPersistedStatus =
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "waiting_approval"

/**
 * Dense table / header copy for persisted workflow runs (deployment-style readability).
 */
export function runPersistedLifecycleLabel(status: WorkflowRunPersistedStatus) {
  if (status === "success") return "Completed"
  if (status === "failed") return "Failed"
  if (status === "cancelled") return "Cancelled"
  if (status === "waiting_approval") return "Awaiting approval"
  return "Running"
}
