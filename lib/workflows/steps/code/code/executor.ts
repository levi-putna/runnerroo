import type { Node } from "@xyflow/react"

import { buildStubOkStepOutput } from "@/lib/workflows/engine/build-stub-step-output"

/** Sandbox execution is not wired yet — emit a stub success payload. */
export async function executeCodeStep({
  node,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  return buildStubOkStepOutput({ node })
}
