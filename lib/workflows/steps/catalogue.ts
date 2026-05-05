/**
 * Aggregates every step definition from grouped folders — single import surface for the catalogue.
 */

import { actionDefinition } from "@/lib/workflows/steps/actions/action/definition"
import { aiChatDefinition } from "@/lib/workflows/steps/ai/chat/definition"
import { aiClassifyDefinition } from "@/lib/workflows/steps/ai/classify/definition"
import { aiExtractDefinition } from "@/lib/workflows/steps/ai/extract/definition"
import { aiGenerateDefinition } from "@/lib/workflows/steps/ai/generate/definition"
import { aiSummarizeDefinition } from "@/lib/workflows/steps/ai/summarize/definition"
import { aiTransformDefinition } from "@/lib/workflows/steps/ai/transform/definition"
import { codeRunDefinition } from "@/lib/workflows/steps/code/code/definition"
import { iterationDefinition } from "@/lib/workflows/steps/code/iteration/definition"
import { randomNumberDefinition } from "@/lib/workflows/steps/code/random/definition"
import { decisionDefinition } from "@/lib/workflows/steps/logic/decision/definition"
import { splitDefinition } from "@/lib/workflows/steps/logic/split/definition"
import { switchDefinition } from "@/lib/workflows/steps/logic/switch/definition"
import { invokeTriggerDefinition } from "@/lib/workflows/steps/triggers/invoke/definition"
import { scheduleTriggerDefinition } from "@/lib/workflows/steps/triggers/schedule/definition"
import { webhookTriggerDefinition } from "@/lib/workflows/steps/triggers/webhook/definition"
import { endDefinition } from "@/lib/workflows/steps/termination/end/definition"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

/** Flat list — UI groups rows by `definition.group`. */
export const STEP_CATALOGUE: StepDefinition[] = [
  invokeTriggerDefinition,
  webhookTriggerDefinition,
  scheduleTriggerDefinition,
  decisionDefinition,
  switchDefinition,
  splitDefinition,
  aiGenerateDefinition,
  aiSummarizeDefinition,
  aiClassifyDefinition,
  aiExtractDefinition,
  aiChatDefinition,
  aiTransformDefinition,
  codeRunDefinition,
  randomNumberDefinition,
  iterationDefinition,
  actionDefinition,
  endDefinition,
]
