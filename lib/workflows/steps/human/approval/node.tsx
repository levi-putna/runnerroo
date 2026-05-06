"use client"

import * as React from "react"
import type { NodeProps } from "@xyflow/react"
import { Check } from "lucide-react"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { Button } from "@/components/ui/button"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"
import { useOptionalWorkflowEditorActions, WorkflowRunContext } from "@/lib/workflows/engine/run-context"

export interface ApprovalNodeData {
  label: string
  description?: string
  subtitle?: string
  [key: string]: unknown
}

/**
 * Canvas preview for human approval checkpoints.
 */
export function ApprovalNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ApprovalNodeData
  const core = WORKFLOW_NODE_CORE_META.approval
  const runState = React.useContext(WorkflowRunContext)
  const editorActions = useOptionalWorkflowEditorActions()
  const isNodeAwaitingApproval = runState.get(id)?.status === "awaiting_approval"
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="approval" size="md" />}
        typeBadge={nodeData.subtitle ?? core.typeLabel}
        label={nodeData.label || "Approval required"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
        headerAction={
          isNodeAwaitingApproval && editorActions ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0 border-violet-600/35 text-violet-700 hover:bg-violet-500/10"
              aria-label="Review approval"
              title="Review approval"
              onClick={(event) => {
                event.stopPropagation()
                editorActions.openPendingApprovalDialog({ nodeId: id })
              }}
            >
              <Check className="size-3.5" />
            </Button>
          ) : null
        }
      />
      <OutputHandle />
    </>
  )
}
