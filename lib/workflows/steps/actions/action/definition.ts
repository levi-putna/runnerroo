import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.action

export const actionDefinition: StepDefinition = {
  type: "action",
  group: "actions",
  label: "Action",
  description: "A generic workflow action step",
  defaultData: { label: "New action", description: "Perform an action" },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
