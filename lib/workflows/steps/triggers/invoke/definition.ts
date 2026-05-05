import { WORKFLOW_ENTRY_KIND_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_ENTRY_KIND_META.invoke

/**
 * Invoke trigger — on-demand runs from the builder **or** structured assistant tool calls (`entryType: "invoke"`).
 * Legacy graphs may still store `entryType: "manual"`; {@link normaliseEntryKind} maps that to `invoke`.
 */
export const invokeTriggerDefinition: StepDefinition = {
  type: "entry",
  subtype: "invoke",
  group: "triggers",
  label: "Invoke",
  description: "Run on demand from the builder or via the assistant with structured inputs",
  defaultData: { label: "Invoke workflow", entryType: "invoke" },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
  glyphClassName: meta.glyphClassName,
}
