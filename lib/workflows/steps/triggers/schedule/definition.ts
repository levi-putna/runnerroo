import { WORKFLOW_ENTRY_KIND_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_ENTRY_KIND_META.schedule

export const scheduleTriggerDefinition: StepDefinition = {
  type: "entry",
  subtype: "schedule",
  group: "triggers",
  label: "Schedule",
  description: "Trigger on a cron schedule",
  defaultData: { label: "Schedule", entryType: "schedule" },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
