import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.random

export const randomNumberDefinition: StepDefinition = {
  type: "random",
  group: "code",
  label: "Random number",
  description: "Draw a uniform value between configurable min and max bounds",
  defaultData: {
    label: "Random number",
    description: "Generate a random number from resolved lower and upper bounds",
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
