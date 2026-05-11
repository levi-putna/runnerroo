/**
 * Run code step — executes author JavaScript inside an isolated sandbox runtime.
 */

import type { Node } from "@xyflow/react"
import { Sandbox } from "@vercel/sandbox"

import { readInputSchemaFromNodeData, type NodeInputField } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  coerceFieldValue,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"
import { coerceCodeStepOutput } from "@/lib/workflows/steps/code/code/code-step-coerce"
import {
  CODE_STEP_MAX_TIMEOUT_MS,
  normaliseCodeStepOutputType,
  normaliseCodeStepTimeoutMs,
} from "@/lib/workflows/steps/code/code/code-step-config"
import { parseCodeStepStdoutForResult } from "@/lib/workflows/steps/code/code/code-step-stdout"
import {
  buildCodeStepSandboxRunnerSource,
  INPUT_PATH,
  RUNNER_PATH,
} from "@/lib/workflows/steps/code/code/code-step-sandbox-runner"
import { rewriteCodeStepReturnsInRunBody } from "@/lib/workflows/steps/code/code/code-step-return-transform"

/** Top-level output key used when `outputSchema` is empty so downstream `{{input.result}}` works. */
export const CODE_STEP_DEFAULT_OUTPUT_KEY = "result"

const STDERR_EXE_MAX = 4000

/** Returns token credentials for `Sandbox.create` only when all three env vars are set (local dev). */
function buildSandboxCredentials(): {
  token?: string
  teamId?: string
  projectId?: string
} {
  const token = process.env.VERCEL_TOKEN?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  const hasAll = Boolean(token && teamId && projectId)
  const hasAny = Boolean(token || teamId || projectId)
  if (hasAny && !hasAll && process.env.NODE_ENV === "development") {
    const missing: string[] = []
    if (!token) missing.push("VERCEL_TOKEN")
    if (!teamId) missing.push("VERCEL_TEAM_ID")
    if (!projectId) missing.push("VERCEL_PROJECT_ID")
    console.warn(
      `[run code] Sandbox provider credentials are incomplete locally; missing ${missing.join(", ")}. ` +
        "Without all three env vars the sandbox client may fall back to an interactive device login flow. " +
        "See your deployment docs for where to read team or project scope identifiers.",
    )
  }
  if (hasAll) {
    return { token, teamId, projectId }
  }
  return {}
}

function buildRuntimeInputObject({
  inputSchema,
  context,
  predecessorInput,
}: {
  inputSchema: NodeInputField[]
  context: Record<string, unknown>
  predecessorInput: unknown
}): unknown {
  const rowsWithValues = inputSchema.filter((f) => typeof f.value === "string" && f.value.trim() !== "")
  if (rowsWithValues.length === 0) {
    return predecessorInput
  }
  const out: Record<string, unknown> = {}
  for (const field of rowsWithValues) {
    const text = resolveTemplate(String(field.value), context)
    out[field.key] = coerceFieldValue({ text, type: field.type })
  }
  return out
}

/**
 * Executes the code step: resolves templates, runs JavaScript in a sandbox, coerces output,
 * and resolves outbound `outputSchema` / `globalsSchema` rows.
 */
export async function executeCodeStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext({ stepInput, stepId: node.id })

  const rawCode = typeof data?.code === "string" ? data.code : ""
  const resolvedSource = resolveTemplate(rawCode, context)

  const outputType = normaliseCodeStepOutputType({ value: data?.codeOutputType })
  const timeoutMs = normaliseCodeStepTimeoutMs({ value: data?.codeTimeoutMs })

  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const predecessorInput = context.input
  const runtimeInput = buildRuntimeInputObject({
    inputSchema,
    context,
    predecessorInput,
  })

  let transformedBody: string
  try {
    transformedBody = rewriteCodeStepReturnsInRunBody({ userBody: resolvedSource })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Run code: could not prepare snippet (${msg}).`)
  }

  const runnerSource = buildCodeStepSandboxRunnerSource({ transformedBody })
  const inputJson = JSON.stringify(runtimeInput)

  const wallStart = Date.now()
  let sandbox: Sandbox | null = null
  let postStopActiveCpuMs: number | undefined
  let exitCode = 1
  let stdoutText = ""
  let stderrText = ""

  try {
    sandbox = await Sandbox.create({
      ...buildSandboxCredentials(),
      timeout: Math.min(CODE_STEP_MAX_TIMEOUT_MS + 120_000, timeoutMs + 120_000),
      runtime: "node22",
    })

    await sandbox.fs.writeFile(INPUT_PATH, inputJson, "utf8")
    await sandbox.fs.writeFile(RUNNER_PATH, runnerSource, "utf8")

    const finished = await sandbox.runCommand("node", [RUNNER_PATH], {
      signal: AbortSignal.timeout(timeoutMs + 5_000),
    })
    exitCode = finished.exitCode
    stdoutText = await finished.stdout()
    stderrText = await finished.stderr()
  } catch (err) {
    const hint =
      "Ensure this deployment is on Vercel (OIDC) or set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID for local runs."
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Run code: sandbox failed (${msg}). ${hint}`)
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop({ blocking: true })
        const cpu = sandbox.activeCpuUsageMs
        if (typeof cpu === "number") {
          postStopActiveCpuMs = cpu
        }
      } catch {
        // Best-effort cleanup
      }
    }
  }

  const executionMs = Math.max(0, Date.now() - wallStart)

  if (exitCode !== 0) {
    const tail = stderrText.trim() || stdoutText.trim() || "(no stderr)"
    throw new Error(`Run code exited with status ${exitCode}: ${tail.slice(0, STDERR_EXE_MAX)}`)
  }

  let parsedRaw: unknown
  try {
    parsedRaw = parseCodeStepStdoutForResult({ stdout: stdoutText })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${msg} Stdout (tail): ${stdoutText.slice(-STDERR_EXE_MAX)}`)
  }

  const coerced = coerceCodeStepOutput({ raw: parsedRaw, outputType })

  const exeContext: Record<string, unknown> = {
    result: coerced,
    execution_ms: executionMs,
    exit_code: exitCode,
    stderr: stderrText.length > STDERR_EXE_MAX ? `${stderrText.slice(0, STDERR_EXE_MAX)}…` : stderrText,
  }
  if (postStopActiveCpuMs !== undefined) {
    exeContext.active_cpu_ms = postStopActiveCpuMs
  }

  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const needsFallback = outputSchema.length === 0
  const fallbackOutputs = needsFallback ? { [CODE_STEP_DEFAULT_OUTPUT_KEY]: coerced } : {}

  const mergedTopLevel = { ...resolvedOutputs, ...fallbackOutputs }
  const mergedOutputsBlock = { ...resolvedOutputs, ...fallbackOutputs }

  const resultPayload: Record<string, unknown> = {
    kind: "code",
    node_id: node.id,
    label,
    ok: true,
    ...mergedTopLevel,
    outputs: mergedOutputsBlock,
    exe: exeContext,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
