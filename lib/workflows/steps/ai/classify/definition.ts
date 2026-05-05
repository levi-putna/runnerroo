import {
  WORKFLOW_AI_FAMILY_META,
  WORKFLOW_AI_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"
import { buildDefaultClassifyLabelRows } from "@/lib/workflows/steps/ai/classify/defaults"

const family = WORKFLOW_AI_FAMILY_META
const row = WORKFLOW_AI_SUBTYPE_META.classify

export const aiClassifyDefinition: StepDefinition = {
  type: "ai",
  subtype: "classify",
  group: "ai",
  label: "Classify",
  description: "Categorise or label input data",
  defaultData: {
    label: "Classify input",
    subtype: "classify",
    model: "claude-sonnet-4-6",
    prompt: "",
    /** When non-empty, resolved tags become the classifier user payload; leave blank to use the Input tab JSON object. */
    classifyContentExpression: "",
    classifyLabelsFromExpression: false,
    classifyLabelsExpression: "",
    classifyLabels: buildDefaultClassifyLabelRows(),
  },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
