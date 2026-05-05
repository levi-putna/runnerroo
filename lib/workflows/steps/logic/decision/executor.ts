import type { Node } from "@xyflow/react"

import { buildStubOkStepOutput } from "@/lib/workflows/engine/build-stub-step-output"

/**
 * Branching is handled by {@link traverseWorkflowGraph}; the executor only records a pass-through payload.
 */
export async function executeDecisionStep({
  node,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  return buildStubOkStepOutput({ node })
}
