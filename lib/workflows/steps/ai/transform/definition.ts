import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.transform

export const aiTransformDefinition: StepDefinition = {
  type: "ai",
  subtype: "transform",
  group: "ai",
  label: "Transform",
  description: "Rewrite or restructure data with AI",
  defaultData: {
    label: "Transform data",
    subtype: "transform",
    model: "claude-sonnet-4-6",
    /** Transformation instructions — describes how the content should be rewritten or restructured. */
    prompt: "",
    /** When non-empty, resolved value is the source for transformation; blank uses Input tab JSON. */
    transformContentExpression: "",
  },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
