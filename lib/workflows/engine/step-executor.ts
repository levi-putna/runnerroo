/**
 * Server-only workflow step dispatcher — composes per-step executors from `lib/workflows/steps/`.
 * Never import this module from client components.
 */

import type { Node } from "@xyflow/react"

import { normaliseAiSubtype } from "@/lib/workflows/engine/node-type-registry"
import type { StepExecutorFn } from "@/lib/workflows/engine/runner"
import { executeActionStep } from "@/lib/workflows/steps/actions/action/executor"
import { executeAiChatStep } from "@/lib/workflows/steps/ai/chat/executor"
import { executeAiClassifyStep } from "@/lib/workflows/steps/ai/classify/executor"
import { executeAiExtractStep } from "@/lib/workflows/steps/ai/extract/executor"
import { executeAiGenerateStep } from "@/lib/workflows/steps/ai/generate/executor"
import { executeAiSummarizeStep } from "@/lib/workflows/steps/ai/summarize/executor"
import { executeAiTransformStep } from "@/lib/workflows/steps/ai/transform/executor"
import { executeCodeStep } from "@/lib/workflows/steps/code/code/executor"
import { executeIterationStep } from "@/lib/workflows/steps/code/iteration/executor"
import { executeRandomNumberStep } from "@/lib/workflows/steps/code/random/executor"
import { buildStubOkStepOutput } from "@/lib/workflows/engine/build-stub-step-output"
import { executeDecisionStep } from "@/lib/workflows/steps/logic/decision/executor"
import { executeSplitStep } from "@/lib/workflows/steps/logic/split/executor"
import { executeSwitchStep } from "@/lib/workflows/steps/logic/switch/executor"
import { executeEntryNode } from "@/lib/workflows/steps/triggers/invoke/executor"
import { executeEndStep } from "@/lib/workflows/steps/termination/end/executor"

/**
 * Creates a real step executor for use with `traverseWorkflowGraph`.
 */
export function createWorkflowStepExecutor(): StepExecutorFn {
  return async ({ node, stepInput }) => dispatchWorkflowStep({ node, stepInput })
}

/**
 * Executes one workflow step — exported for tests or custom runners.
 */
export async function dispatchWorkflowStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<unknown> {
  const t = node.type

  if (t === "entry") {
    return executeEntryNode({ node, stepInput })
  }

  if (t === "ai") {
    const data = node.data as Record<string, unknown> | undefined
    const subtype = normaliseAiSubtype({ value: typeof data?.subtype === "string" ? data.subtype : null })
    switch (subtype) {
      case "generate":
        return executeAiGenerateStep({ node, stepInput })
      case "summarize":
        return executeAiSummarizeStep({ node, stepInput })
      case "classify":
        return executeAiClassifyStep({ node, stepInput })
      case "extract":
        return executeAiExtractStep({ node, stepInput })
      case "chat":
        return executeAiChatStep({ node, stepInput })
      case "transform":
        return executeAiTransformStep({ node, stepInput })
      default:
        return buildStubOkStepOutput({ node })
    }
  }

  if (t === "random") {
    return executeRandomNumberStep({ node, stepInput })
  }

  if (t === "iteration") {
    return executeIterationStep({ node, stepInput })
  }

  if (t === "decision") {
    return executeDecisionStep({ node, stepInput })
  }

  if (t === "switch") {
    return executeSwitchStep({ node, stepInput })
  }

  if (t === "split") {
    return executeSplitStep({ node, stepInput })
  }

  if (t === "code") {
    return executeCodeStep({ node, stepInput })
  }

  if (t === "action") {
    return executeActionStep({ node, stepInput })
  }

  if (t === "end") {
    return executeEndStep({ node, stepInput })
  }

  return buildStubOkStepOutput({ node })
}
