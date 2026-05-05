import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.code

export const codeRunDefinition: StepDefinition = {
  type: "code",
  group: "code",
  label: "Run code",
  description: "Execute TypeScript in a Vercel Sandbox",
  defaultData: {
    label: "Run code",
    language: "typescript",
    description: "Execute custom code",
    code: "export default async function run(input: unknown) {\n  return input\n}",
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
