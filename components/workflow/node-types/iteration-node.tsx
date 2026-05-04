"use client"

import type { NodeProps } from "@xyflow/react"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflow/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "./base-node"
import { InputHandle, OutputHandle } from "./handles"

export interface IterationNodeData {
  label: string
  description?: string
  subtitle?: string
  [key: string]: unknown
}

/** Canvas card for advancing a numeric starting point by a configured increment. */
export function IterationNode({ id, data, selected }: NodeProps) {
  const nodeData = data as IterationNodeData
  const core = WORKFLOW_NODE_CORE_META.iteration
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="iteration" size="md" />}
        typeBadge={nodeData.subtitle ?? core.typeLabel}
        label={nodeData.label || "Iteration"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
      />
      <OutputHandle />
    </>
  )
}
