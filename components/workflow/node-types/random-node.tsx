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

export interface RandomNodeData {
  label: string
  description?: string
  subtitle?: string
  [key: string]: unknown
}

/** Canvas card for uniform random draws between configurable bounds. */
export function RandomNumberNode({ id, data, selected }: NodeProps) {
  const nodeData = data as RandomNodeData
  const core = WORKFLOW_NODE_CORE_META.random
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="random" size="md" />}
        typeBadge={nodeData.subtitle ?? core.typeLabel}
        label={nodeData.label || "Random number"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
      />
      <OutputHandle />
    </>
  )
}
