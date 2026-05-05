import type { Node } from "@xyflow/react"

import { buildStubOkStepOutput } from "@/lib/workflows/engine/build-stub-step-output"

export async function executeSplitStep({
  node,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  return buildStubOkStepOutput({ node })
}
