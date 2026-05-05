import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.summarize

export const aiSummarizeDefinition: StepDefinition = {
  type: "ai",
  subtype: "summarize",
  group: "ai",
  label: "Summarise",
  description: "Condense text into a summary",
  defaultData: {
    label: "Summarise content",
    subtype: "summarize",
    model: "claude-sonnet-4-6",
    /** Optional format, length, or focus hints — the primary summarisation task is hard-coded in the runner. */
    prompt: "",
    /** When non-empty, resolved value is the source to summarise; blank uses Input tab JSON. */
    summarizeContentExpression: "",
  },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
