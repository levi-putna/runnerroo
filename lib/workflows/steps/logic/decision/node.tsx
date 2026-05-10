"use client"

import { Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { resolveWorkflowNodeTilePresentation } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { InputHandle, WorkflowSourceHandle } from "@/lib/workflows/steps/shared/handles"
import {
  WORKFLOW_NODE_SURFACE,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"

export interface DecisionNodeData {
  label: string
  description?: string
  trueLabel?: string
  falseLabel?: string
  condition?: string
  [key: string]: unknown
}

/**
 * Conditional branch marker — rotated tile reads as the diamond checkpoints in the reference UI.
 */
export function DecisionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as DecisionNodeData
  const descriptionText = nodeData.description?.trim()
  const trueLabel = nodeData.trueLabel ?? "True"
  const falseLabel = nodeData.falseLabel ?? "False"
  const { accentBg: decisionAccentBg } = resolveWorkflowNodeTilePresentation({ type: "decision" })
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <div className="flex flex-col items-stretch gap-2 w-[280px]">
      <InputHandle />

      {/* Card — diamond + title row, rationale, forks */}
      <div
        className={cn(
          WORKFLOW_NODE_SURFACE,
          "w-full",
          shellClassName,
        )}
      >
        {/* Header — diamond motif + stacked labels */}
        <div className="flex gap-4 px-3 pt-4 pb-2">
          <div className="relative flex size-[52px] shrink-0 items-center justify-center">
            <div
              className={cn(
                "size-11 rotate-45 rounded-lg shadow-[0_6px_16px_oklch(0_0_0_/_18%)]",
                decisionAccentBg,
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <WorkflowNodeGlyph type="decision" size="hero" className="-rotate-45" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="text-[13px] font-semibold uppercase tracking-wide leading-tight text-foreground">
              {nodeData.label || "Decision"}
            </p>
            <span className="mt-1 block truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              Decision
            </span>
            {nodeData.condition ? (
              <code className="mt-2 w-full truncate rounded-md border border-dashed border-border/70 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {nodeData.condition}
              </code>
            ) : null}
            {/* Plain description when set — edit via node sheet */}
            {descriptionText ? (
              <p className="mt-2 text-xs text-muted-foreground leading-snug line-clamp-3 whitespace-pre-wrap break-words">
                {descriptionText}
              </p>
            ) : null}
          </div>
        </div>

        <div className="h-px w-full bg-border/80" />

        {/* Branch labels */}
        <div className="flex border-t border-border/60 text-xs">
          <div className="flex flex-1 items-center justify-center gap-2 border-r border-border/60 bg-emerald-500/10 py-2 font-semibold text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-500 shadow-sm" aria-hidden />
            {trueLabel}
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 bg-rose-500/10 py-2 font-semibold text-rose-700">
            <span className="size-2 rounded-full bg-rose-500 shadow-sm" aria-hidden />
            {falseLabel}
          </div>
        </div>
      </div>

      {/* Two exit handles anchored under each branch */}
      <div className="relative -mt-2 h-0 w-full">
        <WorkflowSourceHandle
          id="true"
          position={Position.Bottom}
          style={{ left: "26%", bottom: -5 }}
        />
        <WorkflowSourceHandle
          id="false"
          position={Position.Bottom}
          style={{ left: "74%", bottom: -5 }}
        />
      </div>
    </div>
  )
}
