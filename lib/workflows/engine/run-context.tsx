"use client"

import * as React from "react"
import type { NodeResult } from "@/lib/workflows/engine/types"

/** Latest run status per node id (canvas styling / animation). */
export const WorkflowRunContext = React.createContext<Map<string, NodeResult>>(new Map())

/** Editor-only actions: manual run dialog + kicking off a streamed run. */
export interface WorkflowEditorActionsValue {
  /** Opens the manual trigger form (reads entry `inputSchema` from the canvas graph). */
  openManualRunDialog: () => void
  /**
   * Starts executing the workflow with the given manual payload.
   * Updates {@link WorkflowRunContext} as SSE events arrive.
   */
  runWorkflow: (p: { inputs: Record<string, unknown> }) => Promise<void>
  /** True while a streamed run is in flight. */
  isRunning: boolean
  /**
   * Requests to cancel the active run (shows a confirmation prompt before aborting).
   * No-op when no run is in flight.
   */
  stopRun: () => void
  /**
   * Opens the approval modal for the currently paused approval step in the active editor run.
   * No-op when the run is not currently awaiting approval.
   */
  openPendingApprovalDialog: (params?: { nodeId?: string }) => void
  /** True when an approval decision can be taken inline in the editor. */
  canOpenPendingApprovalDialog: boolean
}

export const WorkflowEditorActionsContext = React.createContext<WorkflowEditorActionsValue | null>(null)

/**
 * Returns editor run actions when the canvas is hosted in the workflow editor; otherwise null.
 */
export function useOptionalWorkflowEditorActions() {
  return React.useContext(WorkflowEditorActionsContext)
}
