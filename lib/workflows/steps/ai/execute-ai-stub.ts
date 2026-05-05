import type { Node } from "@xyflow/react"

import { buildStubOkStepOutput } from "@/lib/workflows/engine/build-stub-step-output"

/**
 * Placeholder executor for AI subtypes that do not yet call the model.
 */
export async function executeAiStubStep({
  node,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  return buildStubOkStepOutput({ node })
}
