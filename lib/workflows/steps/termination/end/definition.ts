import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.end

export const endDefinition: StepDefinition = {
  type: "end",
  group: "termination",
  label: "End",
  description: "Stop the workflow — accepts connections in, none out",
  defaultData: {
    label: "End",
    description: "Execution stops here when this branch is reached.",
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
