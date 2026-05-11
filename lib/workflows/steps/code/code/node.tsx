"use client"

import type { NodeProps } from "@xyflow/react"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"

export interface CodeNodeData {
  label: string
  description?: string
  language?: "javascript" | "typescript" | "python"
  code?: string
  [key: string]: unknown
}

const LABELS: Record<NonNullable<CodeNodeData["language"]>, string> = {
  javascript: "JS",
  typescript: "TS",
  python: "PY",
}

/**
 * Canvas card for **Run code** — shared step chrome only; edit the snippet in the step sheet.
 */
export function CodeNode({ id, data, selected }: NodeProps) {
  const nodeData = data as CodeNodeData
  const core = WORKFLOW_NODE_CORE_META.code
  const lang: NonNullable<CodeNodeData["language"]> =
    nodeData.language === "typescript" || nodeData.language === "python" ? nodeData.language : "javascript"
  const mono = LABELS[lang]
  const description =
    typeof nodeData.description === "string"
      ? nodeData.description
      : nodeData.description != null
        ? String(nodeData.description)
        : ""
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="code" size="md" />}
        typeBadge={core.typeLabel}
        label={nodeData.label || "Run code"}
        description={description}
        descriptionClassName="line-clamp-3"
        shellClassName={shellClassName}
        accentColor={core.accentBg}
        headerAction={
          <span className="shrink-0 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] font-medium uppercase text-muted-foreground">
            {mono}
          </span>
        }
      />
      <OutputHandle />
    </>
  )
}
