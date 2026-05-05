import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.chat

export const aiChatDefinition: StepDefinition = {
  type: "ai",
  subtype: "chat",
  group: "ai",
  label: "Chat",
  description: "Multi-turn chat completion",
  defaultData: { label: "Chat completion", subtype: "chat", model: "claude-sonnet-4-6" },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
