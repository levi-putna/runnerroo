import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.split

export const splitDefinition: StepDefinition = {
  type: "split",
  group: "logic",
  label: "Split",
  description: "Send the same inbound payload to every connected outbound path in parallel",
  defaultData: {
    label: "Split",
    description: "Each path receives an identical copy of the upstream payload",
    paths: [
      { id: "sp-a", label: "Path A" },
      { id: "sp-b", label: "Path B" },
    ],
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
