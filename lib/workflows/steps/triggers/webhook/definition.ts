import { WORKFLOW_ENTRY_KIND_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_ENTRY_KIND_META.webhook

export const webhookTriggerDefinition: StepDefinition = {
  type: "entry",
  subtype: "webhook",
  group: "triggers",
  label: "Webhook",
  description: "Trigger via HTTP request",
  defaultData: { label: "Webhook", entryType: "webhook" },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
