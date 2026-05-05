import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"
import { buildDefaultExtractFieldRows } from "@/lib/workflows/steps/ai/extract/defaults"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.extract

export const aiExtractDefinition: StepDefinition = {
  type: "ai",
  subtype: "extract",
  group: "ai",
  label: "Extract data",
  description: "Pull structured data from text",
  defaultData: {
    label: "Extract data",
    subtype: "extract",
    model: "claude-sonnet-4-6",
    /** Author-provided supplementary hints; primary task is hard-coded in the runner. */
    prompt: "",
    /** When non-empty, resolved value is the extraction payload; blank uses Input tab JSON. */
    extractContentExpression: "",
    /** Author-declared fields to extract — drives the dynamic Zod schema. */
    extractFields: buildDefaultExtractFieldRows(),
  },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
