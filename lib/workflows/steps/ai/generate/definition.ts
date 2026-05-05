import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.generate

export const aiGenerateDefinition: StepDefinition = {
  type: "ai",
  subtype: "generate",
  group: "ai",
  label: "Generate text",
  description: "Generate content using an AI model",
  defaultData: { label: "Generate text", subtype: "generate", model: "claude-sonnet-4-6" },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
