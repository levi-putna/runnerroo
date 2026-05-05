import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.iteration

export const iterationDefinition: StepDefinition = {
  type: "iteration",
  group: "code",
  label: "Iteration",
  description: "Add an increment (default 1) to a starting number from the inputs",
  defaultData: {
    label: "Iteration",
    description: "Advance a numeric counter by an expression-backed increment",
    iterationIncrement: "1",
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
