/**
 * Workflow steps — catalogue metadata and React Flow node components (client-safe).
 * Server-only execution: import from `@/lib/workflows/engine/step-executor` or `@/lib/workflows/engine/runner`.
 */

export { STEP_CATALOGUE } from "@/lib/workflows/steps"
export type { StepDefinition } from "@/lib/workflows/engine/step-definition"
export { workflowNodeTypes, type WorkflowNodeTypesMap } from "@/lib/workflows/workflow-node-types"

// Re-export types used by the editor and run views (client + server).
export type { NodeResult } from "@/lib/workflows/engine/types"
export {
  mergeNodeResult,
  mergeNodeResultsIntoList,
  traverseWorkflowGraph,
  type StepExecutorFn,
  type TraverseWorkflowGraphParams,
} from "@/lib/workflows/engine/runner"

export {
  defaultWorkflowCanvasNodes,
  parseWorkflowEdges,
  parseWorkflowNodes,
  toPersistableEdges,
  toPersistableNodes,
  workflowEditorBaseline,
  workflowGraphBaseline,
} from "@/lib/workflows/engine/persist"
