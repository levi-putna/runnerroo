import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.extract

export const aiExtractDefinition: StepDefinition = {
  type: "ai",
  subtype: "extract",
  group: "ai",
  label: "Extract data",
  description: "Pull structured data from text",
  defaultData: { label: "Extract data", subtype: "extract", model: "claude-sonnet-4-6" },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
