"use client"

import type { NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflow/node-type-registry"
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
export function EndNode({ data, selected }: NodeProps) {
  const nodeData = data as EndNodeData
  const title = (nodeData.label ?? "End").trim() || "End"
  const endMeta = WORKFLOW_NODE_CORE_META.end

  return (
    <div className="flex flex-col items-center">
      <InputHandle />

      {/* Minimal terminator disc — intent only, not a full step card */}
      <div
        className={cn(
          "flex size-[52px] items-center justify-center rounded-full border border-rose-700/35 shadow-[0_4px_14px_oklch(55%_0.2_15_/_28%)] transition-[box-shadow,transform]",
          endMeta.accentBg,
          selected
            ? "ring-[6.75px] ring-blue-500/50 scale-[1.02]"
            : "hover:shadow-[0_6px_18px_oklch(55%_0.2_15_/_35%)]"
        )}
        title={title}
        aria-label={`${title}, end of workflow`}
      >
        <WorkflowNodeGlyph type="end" size="endDisc" stroke="emphasis" />
      </div>
    </div>
  )
}
