"use client"

import * as React from "react"
import { type NodeProps } from "@xyflow/react"
import { Play, Square } from "lucide-react"
import {
  WORKFLOW_ENTRY_KIND_META,
  WORKFLOW_TRIGGER_RUN_BUTTON_OUTLINE_CLASSNAME,
  normaliseEntryKind,
} from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { OutputHandle } from "@/lib/workflows/steps/shared/handles"
import {
  BaseNode,
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
 * Starts the graph — uses {@link BaseNode} for a consistent header with all other step cards.
 *
 * Outbound data for the rest of the workflow is driven by the trigger payload fields on the **Input** tab
 * (`inputSchema`); the runner evaluates those rows like a step output — see `triggers/invoke/executor.ts`.
 */
export function EntryNode({ id, data, selected }: NodeProps) {
  const nodeData = data as EntryNodeData
  const editorActions = useOptionalWorkflowEditorActions()
  const kind = normaliseEntryKind({ value: nodeData.entryType })
  const cfg = WORKFLOW_ENTRY_KIND_META[kind]
  const label = nodeData.label ?? cfg.defaultLabel
  const invokeTrigger = kind === "invoke"

  /** Simulated-run halo synced with downstream steps */
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  /** Play / Stop button shown only on the invoke trigger variant */
  const headerAction = invokeTrigger && editorActions ? (
    editorActions.isRunning ? (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
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
        className={WORKFLOW_TRIGGER_RUN_BUTTON_OUTLINE_CLASSNAME}
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
  ) : undefined

  return (
    <div className="flex flex-col items-center gap-3">
      <BaseNode
        icon={<WorkflowNodeGlyph type="entry" entryType={nodeData.entryType} size="md" />}
        typeBadge={cfg.canvasBadge}
        label={label}
        description="Starts the workflow when this trigger fires."
        shellClassName={shellClassName}
        accentColor={cfg.accentBg}
        headerAction={headerAction}
      />

      {/* Bottom exit — round disc, same wired / unwired ring colours as other steps */}
      <OutputHandle />
    </div>
  )
}
