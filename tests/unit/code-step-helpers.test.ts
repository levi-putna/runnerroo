import assert from "node:assert/strict"
import test from "node:test"

import { coerceCodeStepOutput } from "@/lib/workflows/steps/code/code/code-step-coerce"
import { normaliseCodeStepTimeoutMs } from "@/lib/workflows/steps/code/code/code-step-config"
import { parseCodeStepStdoutForResult } from "@/lib/workflows/steps/code/code/code-step-stdout"
import { CODE_STEP_STDOUT_RESULT_PREFIX, rewriteCodeStepReturnsInRunBody } from "@/lib/workflows/steps/code/code/code-step-return-transform"

test("rewriteCodeStepReturnsInRunBody rewrites a top-level return", () => {
  const out = rewriteCodeStepReturnsInRunBody({ userBody: "return 41" })
  assert.match(out, /__WORKFLOW_emitReturn/)
  assert.match(out, /41/)
})

test("rewriteCodeStepReturnsInRunBody leaves nested function returns unchanged", () => {
  const body = `function inner() { return 2 }\nreturn 1`
  const out = rewriteCodeStepReturnsInRunBody({ userBody: body })
  assert.match(out, /__WORKFLOW_emitReturn\(1\)/)
  assert.match(out, /return 2/)
})

test("parseCodeStepStdoutForResult reads the last prefixed line", () => {
  const stdout = `debug\n${CODE_STEP_STDOUT_RESULT_PREFIX}${JSON.stringify({ value: { a: 1 } })}\nnoise\n${CODE_STEP_STDOUT_RESULT_PREFIX}${JSON.stringify({ value: "final" })}\n`
  const v = parseCodeStepStdoutForResult({ stdout })
  assert.equal(v, "final")
})

test("coerceCodeStepOutput coerces to number", () => {
  assert.equal(coerceCodeStepOutput({ raw: "3.5", outputType: "number" }), 3.5)
})

test("normaliseCodeStepTimeoutMs clamps", () => {
  assert.equal(normaliseCodeStepTimeoutMs({ value: 500 }), 1000)
  assert.equal(normaliseCodeStepTimeoutMs({ value: 90_000 }), 60_000)
})
