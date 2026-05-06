import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.approval

/**
 * Human approval checkpoint — execution pauses until an operator approves or declines in the Inbox.
 */
export const approvalDefinition: StepDefinition = {
  type: "approval",
  group: "human",
  label: "Approval",
  description: "Pause and require an operator to approve before continuing",
  defaultData: {
    label: "Approval required",
    description: "",
    // Templated reviewer message (Inbox): `{{prev.*}}`, `{{input.*}}`, `{{global.*}}`, `{{now.*}}`, etc.
    approvalMessage: "",
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
