import { CODE_STEP_STDOUT_RESULT_PREFIX } from "@/lib/workflows/steps/code/code/code-step-return-transform"

export interface ParseCodeStepStdoutForResultParams {
  stdout: string
}

/**
 * Reads the **last** stdout line starting with {@link CODE_STEP_STDOUT_RESULT_PREFIX}.
 * Earlier lines may be user `console.log` output.
 */
export function parseCodeStepStdoutForResult({ stdout }: ParseCodeStepStdoutForResultParams): unknown {
  const lines = stdout.split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim() ?? ""
    if (!line.startsWith(CODE_STEP_STDOUT_RESULT_PREFIX)) continue
    const jsonPart = line.slice(CODE_STEP_STDOUT_RESULT_PREFIX.length)
    const parsed = JSON.parse(jsonPart) as { value?: unknown }
    return parsed.value
  }
  throw new Error("Run code step did not emit a result line (expected stdout line with result prefix).")
}
