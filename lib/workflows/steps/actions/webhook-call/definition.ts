import {
  buildDefaultWebhookCallOutputSchemaFields,
} from "@/lib/workflows/engine/input-schema"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.webhookCall

export const webhookCallDefinition: StepDefinition = {
  type: "webhookCall",
  group: "actions",
  label: "Webhook",
  description: "Send an HTTP request to a URL and capture the response status code",
  defaultData: {
    label: "Webhook",
    description: "Send an HTTP request to a remote URL",
    method: "POST",
    url: "",
    bodyTemplate: "",
    outputSchema: buildDefaultWebhookCallOutputSchemaFields(),
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
