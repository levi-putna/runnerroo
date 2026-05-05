"use client"

import { ActionNode } from "@/lib/workflows/steps/actions/action/node"
import { AiNode } from "@/lib/workflows/steps/ai/node"
import { CodeNode } from "@/lib/workflows/steps/code/code/node"
import { IterationNode } from "@/lib/workflows/steps/code/iteration/node"
import { RandomNumberNode } from "@/lib/workflows/steps/code/random/node"
import { GenerateDocumentNode } from "@/lib/workflows/steps/documents/generate-document/node"
import { DecisionNode } from "@/lib/workflows/steps/logic/decision/node"
import { SplitNode } from "@/lib/workflows/steps/logic/split/node"
import { SwitchNode } from "@/lib/workflows/steps/logic/switch/node"
import { EntryNode } from "@/lib/workflows/steps/triggers/node"
import { EndNode } from "@/lib/workflows/steps/termination/end/node"

/**
 * React Flow `nodeTypes` map — register once per canvas instance.
 */
export const workflowNodeTypes = {
  entry: EntryNode,
  action: ActionNode,
  code: CodeNode,
  random: RandomNumberNode,
  iteration: IterationNode,
  document: GenerateDocumentNode,
  ai: AiNode,
  decision: DecisionNode,
  switch: SwitchNode,
  split: SplitNode,
  end: EndNode,
}

export type WorkflowNodeTypesMap = typeof workflowNodeTypes
