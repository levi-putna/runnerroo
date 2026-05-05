import type { LucideIcon } from "lucide-react"

import type { WorkflowStepGroupId } from "@/lib/workflows/engine/node-type-registry"

/**
 * Catalogue row for the step picker and aggregated exports (`STEP_CATALOGUE`).
 */
export interface StepDefinition {
  type: string
  subtype?: string
  group: WorkflowStepGroupId
  label: string
  description: string
  defaultData: Record<string, unknown>
  Icon: LucideIcon
  accentBg: string
  accentHex: string
  glyphClassName?: string
}
