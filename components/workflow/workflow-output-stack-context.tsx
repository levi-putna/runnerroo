"use client"

import * as React from "react"

/** Visual stack frames for Output schema / Workflow globals drill-down (mirrors Switch case navigation). */
export type SchemaEditorStackPanel =
  | { view: "list" }
  | { view: "field"; fieldId: string }
  | { view: "add" }

export type WorkflowOutputStackScope = "outputSchema" | "globals"

/** Actions rendered in the Output/globals sheet sub-header (Save / Cancel) while drilling a field or add view. */
export interface WorkflowOutputStackSubHeaderActions {
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  onCancel: () => void
  cancelDisabled?: boolean
}

/**
 * Shared drill-down state for the node sheet **Output** tab only.
 * Entry-trigger output mapping on the Input tab keeps local stack state (`enabled` false).
 */
export interface WorkflowOutputStackContextValue {
  /** When false, {@link InputSchemaBuilder} uses internal stack state (not on Output tab). */
  enabled: boolean
  outputSchemaPanel: SchemaEditorStackPanel
  setOutputSchemaPanelExclusive: React.Dispatch<React.SetStateAction<SchemaEditorStackPanel>>
  globalsPanel: SchemaEditorStackPanel
  setGlobalsPanelExclusive: React.Dispatch<React.SetStateAction<SchemaEditorStackPanel>>
  /** Clears both stacks — leaving Output tab, opening bulk JSON edit from the schema menu, or sheet bar Back. */
  resetBothPanels: () => void
  /** Which subsection owns the current drill frame, if any. */
  activeScope: WorkflowOutputStackScope | null
  /**
   * Registers primary/cancel controls for the sheet sub-header row; pass `null` when leaving drill-down or
   * when actions should clear.
   */
  registerOutputStackSubHeaderActions: (actions: WorkflowOutputStackSubHeaderActions | null) => void
}

const WorkflowOutputStackContext = React.createContext<WorkflowOutputStackContextValue | null>(null)

export function WorkflowOutputStackProvider({
  value,
  children,
}: {
  value: WorkflowOutputStackContextValue
  children: React.ReactNode
}) {
  return <WorkflowOutputStackContext.Provider value={value}>{children}</WorkflowOutputStackContext.Provider>
}

/** Present only under {@link WorkflowOutputStackProvider}; returns null when missing. */
export function useWorkflowOutputStackContext(): WorkflowOutputStackContextValue | null {
  return React.useContext(WorkflowOutputStackContext)
}
