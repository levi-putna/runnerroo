import type { NodeInputField } from "./input-schema"

export type TriggerType = "manual" | "webhook" | "cron"
export type NodeType =
  | "trigger"
  | "action"
  | "code"
  | "ai"
  | "condition"
  | "transform"
  | "switch"
  | "split"
  | "end"

export interface WorkflowTrigger {
  type: TriggerType
  config: ManualTriggerConfig | WebhookTriggerConfig | CronTriggerConfig
}

export interface ManualTriggerConfig {
  type: "manual"
}

export interface WebhookTriggerConfig {
  type: "webhook"
  path: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  secret?: string
}

export interface CronTriggerConfig {
  type: "cron"
  schedule: string
  timezone: string
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowNodeData {
  label: string
  description?: string
  config: Record<string, unknown>
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  /** Declared typed inputs for this step; referenced as `{{input.key}}` alongside inbound `{{prev.*}}` from the predecessor. */
  inputSchema?: NodeInputField[]
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  trigger: WorkflowTrigger
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  status: "active" | "inactive" | "draft"
  created_at: string
  updated_at: string
  user_id: string
  last_run_at?: string
  run_count: number
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  status: "running" | "success" | "failed" | "cancelled"
  started_at: string
  completed_at?: string
  duration_ms?: number
  trigger_type: TriggerType
  error?: string
  node_results: NodeResult[]
}

export interface NodeResult {
  node_id: string
  status: "pending" | "running" | "success" | "failed" | "skipped"
  started_at?: string
  completed_at?: string
  output?: unknown
  error?: string
}
