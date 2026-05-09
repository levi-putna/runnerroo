import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"
import {
  DEFAULT_ITERATION_INCREMENT_EXPRESSION,
  DEFAULT_ITERATION_STARTING_NUMBER_EXPRESSION,
} from "@/lib/workflows/steps/code/iteration/executor"

const meta = WORKFLOW_NODE_CORE_META.iteration

export const iterationDefinition: StepDefinition = {
  type: "iteration",
  group: "code",
  label: "Iteration",
  description: "Add an increment (default 1) to the upstream starting number",
  defaultData: {
    label: "Iteration",
    description: "Advance a numeric counter by an expression-backed increment",
    iterationStartingNumberExpression: DEFAULT_ITERATION_STARTING_NUMBER_EXPRESSION,
    iterationIncrement: DEFAULT_ITERATION_INCREMENT_EXPRESSION,
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
