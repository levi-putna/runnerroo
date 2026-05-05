"use client"

import * as React from "react"
import { type NodeProps } from "@xyflow/react"
import { Play, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { WORKFLOW_ENTRY_KIND_META, normaliseEntryKind } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"
import { OutputHandle } from "@/lib/workflows/steps/shared/handles"
import {
  WORKFLOW_NODE_SURFACE,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"
import { useOptionalWorkflowEditorActions } from "@/lib/workflows/engine/run-context"
import { Button } from "@/components/ui/button"

export interface EntryNodeData {
  label?: string
  /** Canonical `invoke`; legacy graphs may still persist `manual`. */
  entryType?: "invoke" | "manual" | "webhook" | "schedule"
  [key: string]: unknown
}

/**
 * Starts the graph — rectangular trigger card harmonised with the main step styling.
 */
export function EntryNode({ id, data, selected }: NodeProps) {
  const nodeData = data as EntryNodeData
  const editorActions = useOptionalWorkflowEditorActions()
  const kind = normaliseEntryKind({ value: nodeData.entryType })
  const cfg = WORKFLOW_ENTRY_KIND_META[kind]
  const title = (nodeData.label ?? cfg.defaultLabel).toUpperCase()
  const invokeTrigger = kind === "invoke"

  /** Simulated-run halo synced with downstream steps */
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Entry card — square shell (sharp corners) distinct from rounded step nodes */}
      <div
        className={cn(
          WORKFLOW_NODE_SURFACE,
          "w-[260px] !rounded-none",
          shellClassName,
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
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold uppercase tracking-wide truncate min-w-0">
                {title}
              </p>
              {/* Manual trigger — Play to launch run dialog; swaps to Stop while a run is in flight */}
              {invokeTrigger && editorActions ? (
                editorActions.isRunning ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 rounded-none border-destructive/40 text-destructive hover:bg-destructive/10"
                    aria-label="Stop workflow run"
                    title="Stop workflow run"
                    onClick={(evt) => {
                      evt.stopPropagation()
                      editorActions.stopRun()
                    }}
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 rounded-none border-emerald-600/35 text-emerald-700 hover:bg-emerald-500/10"
                    aria-label="Run workflow"
                    title="Run workflow"
                    onClick={(evt) => {
                      evt.stopPropagation()
                      editorActions.openManualRunDialog()
                    }}
                  >
                    <Play className="size-3.5 fill-current" />
                  </Button>
                )
              ) : null}
            </div>
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
