import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.decision

export const decisionDefinition: StepDefinition = {
  type: "decision",
  group: "logic",
  label: "Decision",
  description: "Branch based on a condition",
  defaultData: { label: "Decision", description: "Check a condition and branch" },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
