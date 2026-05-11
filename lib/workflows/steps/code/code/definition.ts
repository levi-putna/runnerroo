import { buildDefaultCodeStepOutputSchemaFields } from "@/lib/workflows/engine/input-schema"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.code

export const codeRunDefinition: StepDefinition = {
  type: "code",
  group: "code",
  label: "Run code",
  description: "Execute JavaScript code in a sandbox environment and return a single result.",
  defaultData: {
    label: "Run code",
    language: "javascript",
    description: "Execute JavaScript code in a sandbox environment and return a single result.",
    code: "return input\n",
    codeTimeoutMs: 15_000,
    codeOutputType: "string",
    outputSchema: buildDefaultCodeStepOutputSchemaFields(),
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
