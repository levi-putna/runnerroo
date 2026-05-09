/**
 * Aggregates every step definition from grouped folders — single import surface for the catalogue.
 */

import { actionDefinition } from "@/lib/workflows/steps/actions/action/definition"
import { webhookCallDefinition } from "@/lib/workflows/steps/actions/webhook-call/definition"
import { aiChatDefinition } from "@/lib/workflows/steps/ai/chat/definition"
import { aiClassifyDefinition } from "@/lib/workflows/steps/ai/classify/definition"
import { aiExtractDefinition } from "@/lib/workflows/steps/ai/extract/definition"
import { aiGenerateDefinition } from "@/lib/workflows/steps/ai/generate/definition"
import { aiSummarizeDefinition } from "@/lib/workflows/steps/ai/summarize/definition"
import { aiTransformDefinition } from "@/lib/workflows/steps/ai/transform/definition"
import { codeRunDefinition } from "@/lib/workflows/steps/code/code/definition"
import { iterationDefinition } from "@/lib/workflows/steps/code/iteration/definition"
import { randomNumberDefinition } from "@/lib/workflows/steps/code/random/definition"
import { documentFromTemplateDefinition } from "@/lib/workflows/steps/documents/document-from-template/definition"
import { documentFromXmlDefinition } from "@/lib/workflows/steps/documents/document-xml/definition"
import { decisionDefinition } from "@/lib/workflows/steps/logic/decision/definition"
import { splitDefinition } from "@/lib/workflows/steps/logic/split/definition"
import { switchDefinition } from "@/lib/workflows/steps/logic/switch/definition"
import { invokeTriggerDefinition } from "@/lib/workflows/steps/triggers/invoke/definition"
import { scheduleTriggerDefinition } from "@/lib/workflows/steps/triggers/schedule/definition"
import { webhookTriggerDefinition } from "@/lib/workflows/steps/triggers/webhook/definition"
import { approvalDefinition } from "@/lib/workflows/steps/human/approval/definition"
import { endDefinition } from "@/lib/workflows/steps/termination/end/definition"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

/**
 * Flat list — the add-step sheet groups rows by `definition.group`, so this array's
 * order mainly controls the in-group ordering. Comments below mirror the section
 * layout under `lib/workflows/steps/` for quick navigation.
 */
export const STEP_CATALOGUE: StepDefinition[] = [
  // ─── Triggers (entry family — variant chosen via data.entryType) ──────────
  invokeTriggerDefinition,
  webhookTriggerDefinition,
  scheduleTriggerDefinition,

  // ─── Logic / branching ────────────────────────────────────────────────────
  decisionDefinition,
  switchDefinition,
  splitDefinition,

  // ─── Human-in-the-loop ────────────────────────────────────────────────────
  approvalDefinition,

  // ─── AI family (data.subtype selects the executor) ───────────────────────
  aiGenerateDefinition,
  aiSummarizeDefinition,
  aiClassifyDefinition,
  aiExtractDefinition,
  aiChatDefinition,
  aiTransformDefinition,

  // ─── Code family ──────────────────────────────────────────────────────────
  codeRunDefinition,
  randomNumberDefinition,
  iterationDefinition,

  // ─── Documents (data.subtype selects template vs docxml) ─────────────────
  documentFromTemplateDefinition,
  documentFromXmlDefinition,

  // ─── Actions ──────────────────────────────────────────────────────────────
  actionDefinition,
  webhookCallDefinition,

  // ─── Termination ──────────────────────────────────────────────────────────
  endDefinition,
]
