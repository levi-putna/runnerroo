/**
 * Formats an ISO timestamp for display in run history UIs.
 */
export function formatRunLocalDate(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.valueOf())) return iso
    return d.toLocaleString()
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

/**
 * Dense table / header copy for persisted workflow runs (deployment-style readability).
 */
export function runPersistedLifecycleLabel(status: WorkflowRunPersistedStatus) {
  if (status === "success") return "Completed"
  if (status === "failed") return "Failed"
  if (status === "cancelled") return "Cancelled"
  return "Running"
}
