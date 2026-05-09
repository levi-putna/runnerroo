"use client"

import * as React from "react"

const WorkflowNavigationResetContext = React.createContext<string | undefined>(undefined)

/**
 * Supplies the active workflow node id so nested editors (Output schema, globals, …) can reset
 * drill-down navigation when the user selects another step.
 */
export function WorkflowNavigationResetProvider({
  nodeId,
  children,
}: {
  nodeId: string
  children: React.ReactNode
}) {
  return (
    <WorkflowNavigationResetContext.Provider value={nodeId}>{children}</WorkflowNavigationResetContext.Provider>
  )
}

/**
 * Current sheet node id when rendered inside {@link WorkflowNavigationResetProvider}, else undefined.
 */
export function useWorkflowNavigationResetKey(): string | undefined {
  return React.useContext(WorkflowNavigationResetContext)
}
