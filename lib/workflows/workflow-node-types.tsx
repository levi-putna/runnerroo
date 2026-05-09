"use client"

import { ActionNode } from "@/lib/workflows/steps/actions/action/node"
import { WebhookCallNode } from "@/lib/workflows/steps/actions/webhook-call/node"
import { AiNode } from "@/lib/workflows/steps/ai/node"
import { CodeNode } from "@/lib/workflows/steps/code/code/node"
import { IterationNode } from "@/lib/workflows/steps/code/iteration/node"
import { RandomNumberNode } from "@/lib/workflows/steps/code/random/node"
import { WorkflowDocumentNode } from "@/lib/workflows/steps/documents/document-node"
import { DecisionNode } from "@/lib/workflows/steps/logic/decision/node"
import { SplitNode } from "@/lib/workflows/steps/logic/split/node"
import { SwitchNode } from "@/lib/workflows/steps/logic/switch/node"
import { EntryNode } from "@/lib/workflows/steps/triggers/node"
import { ApprovalNode } from "@/lib/workflows/steps/human/approval/node"
import { EndNode } from "@/lib/workflows/steps/termination/end/node"

/**
 * React Flow `nodeTypes` map — register once per canvas instance.
 *
 * Keys must match the `type` strings used in `STEP_CATALOGUE` and
 * `dispatchWorkflowStep`; entries are grouped by step family below to mirror
 * the layout under `lib/workflows/steps/`.
 *
 * Family steps (`entry`, `ai`, `document`) intentionally share a single
 * canvas component — variants are chosen at render time from `data.subtype`
 * (or `data.entryType`).
 */
export const workflowNodeTypes = {
  // Triggers (variant chosen via data.entryType inside EntryNode)
  entry: EntryNode,

  // Actions
  action: ActionNode,
  webhookCall: WebhookCallNode,

  // Human
  approval: ApprovalNode,

  // Code family
  code: CodeNode,
  random: RandomNumberNode,
  iteration: IterationNode,

  // Documents (template vs docxml chosen via data.subtype)
  document: WorkflowDocumentNode,

  // AI family (template chosen via data.subtype)
  ai: AiNode,

  // Logic / branching
  decision: DecisionNode,
  switch: SwitchNode,
  split: SplitNode,

  // Termination
  end: EndNode,
}

export type WorkflowNodeTypesMap = typeof workflowNodeTypes
