import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.switch

export const switchDefinition: StepDefinition = {
  type: "switch",
  group: "logic",
  label: "Switch",
  description: "Route to multiple paths with ordered conditions and an else branch",
  defaultData: {
    label: "Switch",
    description: "Evaluate cases in order; use Else when none match",
    defaultBranchLabel: "Else",
    branches: [
      { id: "sw-a", label: "Case A", condition: "" },
      { id: "sw-b", label: "Case B", condition: "" },
    ],
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
