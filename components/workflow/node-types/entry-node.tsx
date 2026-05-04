"use client"

import * as React from "react"
import { type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { WORKFLOW_ENTRY_KIND_META, normaliseEntryKind } from "@/lib/workflow/node-type-registry"
import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"
import { OutputHandle } from "./handles"
import { WORKFLOW_NODE_SURFACE } from "./base-node"

export interface EntryNodeData {
  label?: string
  entryType?: "manual" | "webhook" | "schedule"
  [key: string]: unknown
}

/**
 * Starts the graph — rectangular trigger card harmonised with the main step styling.
 */
export function EntryNode({ data, selected }: NodeProps) {
  const nodeData = data as EntryNodeData
  const kind = normaliseEntryKind({ value: nodeData.entryType })
  const cfg = WORKFLOW_ENTRY_KIND_META[kind]
  const title = (nodeData.label ?? cfg.defaultLabel).toUpperCase()

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Entry card — square shell (sharp corners) distinct from rounded step nodes */}
      <div
        className={cn(
          WORKFLOW_NODE_SURFACE,
          "w-[260px] !rounded-none",
          selected
            ? "ring-[6.75px] ring-blue-500/50 shadow-[0_8px_28px_oklch(0_0_0/12%)]"
            : "hover:border-border hover:shadow-[0_4px_16px_oklch(0_0_0/8%)]"
        )}
      >

        {/* Header */}
        <div className="flex gap-3 px-3 pt-3 pb-2">
          {/* Trigger variant icon — registry colours + manual filled play */}
          <WorkflowNodeIconTile
            type="entry"
            entryType={nodeData.entryType}
            size="md"
            frameClassName="flex size-9 shrink-0 items-center justify-center rounded-none shadow-inner"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-wide truncate">
              {title}
            </p>
            <span className="mt-2 inline-flex rounded-sm border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cfg.canvasBadge}
            </span>
          </div>
        </div>

        <div className="h-px w-full bg-border/80" />
        {/* Triggers seldom need copy, but reserve the runway for symmetry */}
        <div className="px-3 py-3 text-[11px] text-muted-foreground">
          Starts the workflow when this trigger fires.
        </div>
      </div>

      {/* Bottom exit — round disc, same wired / unwired ring colours as other steps */}
      <OutputHandle />
    </div>
  )
}
