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

export interface ActionNodeData {
  label: string
  description?: string
  subtitle?: string
  [key: string]: unknown
}

export function ActionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ActionNodeData
  const core = WORKFLOW_NODE_CORE_META.action
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="action" size="md" />}
        typeBadge={nodeData.subtitle ?? core.typeLabel}
        label={nodeData.label || "New action"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
      />
      <OutputHandle />
    </>
  )
}
