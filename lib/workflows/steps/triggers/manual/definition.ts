import { WORKFLOW_ENTRY_KIND_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_ENTRY_KIND_META.manual

/** Manual trigger — starts from the step catalogue as an entry node with `entryType: "manual"`. */
export const manualTriggerDefinition: StepDefinition = {
  type: "entry",
  group: "triggers",
  label: "Manual run",
  description: "Trigger the workflow manually",
  defaultData: { label: "Manual run", entryType: "manual" },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
  glyphClassName: meta.glyphClassName,
}
