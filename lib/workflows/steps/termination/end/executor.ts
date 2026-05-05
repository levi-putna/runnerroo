import type { Node } from "@xyflow/react"

import { buildStubOkStepOutput } from "@/lib/workflows/engine/build-stub-step-output"

/** End nodes terminate traversal; output is stored for observability only. */
export async function executeEndStep({
  node,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  return buildStubOkStepOutput({ node })
}
