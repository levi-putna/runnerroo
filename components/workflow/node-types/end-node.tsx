"use client"

import type { NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflow/node-type-registry"
import {
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "./base-node"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { InputHandle } from "./handles"

/** Persisted step label / notes; the canvas shows only the icon disc. */
export interface EndNodeData {
  label: string
  description?: string
  [key: string]: unknown
}

/**
 * Lightweight sink marker — circular icon-only hint that this branch completes here.
 */
export function EndNode({ id, data, selected }: NodeProps) {
  const nodeData = data as EndNodeData
  const title = (nodeData.label ?? "End").trim() || "End"
  const endMeta = WORKFLOW_NODE_CORE_META.end
  const runRing = useWorkflowNodeRunRingClassName(id)
  /** End disc uses the shared shell helper so simulated runs share the same outcome colours */
  const haloShell = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <div className="flex flex-col items-center">
      <InputHandle />

      {/* Minimal terminator disc — intent only, not a full step card */}
      <div
        className={cn(
          "flex size-[52px] items-center justify-center rounded-full border border-rose-700/35 shadow-[0_4px_14px_oklch(55%_0.2_15_/_28%)] transition-[box-shadow,transform]",
          endMeta.accentBg,
          haloShell,
          !runRing && selected ? "scale-[1.02]" : null,
          !runRing && !selected ? "hover:shadow-[0_6px_18px_oklch(55%_0.2_15_/_35%)]" : null
        )}
        title={title}
        aria-label={`${title}, end of workflow`}
      >
        <WorkflowNodeGlyph type="end" size="endDisc" stroke="emphasis" />
      </div>
    </div>
  )
}
