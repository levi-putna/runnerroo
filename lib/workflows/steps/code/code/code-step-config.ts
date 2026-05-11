import type { CodeStepOutputType } from "@/lib/workflows/steps/code/code/code-step-coerce"

const DEFAULT_CODE_TIMEOUT_MS = 15_000
const MIN_CODE_TIMEOUT_MS = 1_000

/** Maximum author-selected timeout (matches Execution tab clamp). */
export const CODE_STEP_MAX_TIMEOUT_MS = 60_000

/**
 * Normalises persisted `codeOutputType` onto the supported union.
 */
export function normaliseCodeStepOutputType({ value }: { value: unknown }): CodeStepOutputType {
  if (value === "number" || value === "json" || value === "null" || value === "string") {
    return value
  }
  return "string"
}

/**
 * Clamps sandbox / step timeout to a safe range (1s–60s).
 */
export function normaliseCodeStepTimeoutMs({ value }: { value: unknown }): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CODE_TIMEOUT_MS
  return Math.min(CODE_STEP_MAX_TIMEOUT_MS, Math.max(MIN_CODE_TIMEOUT_MS, Math.floor(n)))
}
