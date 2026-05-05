"use client"

import type { NodeProps } from "@xyflow/react"

import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"

export interface GenerateDocumentNodeData {
  label: string
  description?: string
  subtitle?: string
  [key: string]: unknown
}

/**
 * Canvas card for document generation from a stored template.
 */
export function GenerateDocumentNode({ id, data, selected }: NodeProps) {
  const nodeData = data as GenerateDocumentNodeData
  const core = WORKFLOW_NODE_CORE_META.document
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      {/* Incoming workflow payload */}
      <InputHandle />
      {/* Node card body */}
      <BaseNode
        icon={<WorkflowNodeGlyph type="document" size="md" />}
        typeBadge={nodeData.subtitle ?? core.typeLabel}
        label={nodeData.label || "Generate document"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
      />
      {/* Outgoing generated document payload */}
      <OutputHandle />
    </>
  )
}
