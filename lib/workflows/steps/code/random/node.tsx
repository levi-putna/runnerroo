"use client"

import type { NodeProps } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"

export interface RandomNodeData {
  label: string
  description?: string
  subtitle?: string
  /** Declared Input-tab fields available as `{{input.*}}` in execution expressions. */
  inputSchema?: unknown
  /** Execution expression for the inclusive lower bound. */
  randomMinExpression?: string
  /** Execution expression for the inclusive upper bound. */
  randomMaxExpression?: string
  [key: string]: unknown
}

/** Canvas card for uniform random draws between configurable bounds. */
export function RandomNumberNode({ id, data, selected }: NodeProps) {
  const nodeData = data as RandomNodeData
  const core = WORKFLOW_NODE_CORE_META.random
  const metadataRows = buildRandomNumberCanvasMetadataRows({
    inputSchema: nodeData.inputSchema,
    randomMinExpression: typeof nodeData.randomMinExpression === "string" ? nodeData.randomMinExpression : "",
    randomMaxExpression: typeof nodeData.randomMaxExpression === "string" ? nodeData.randomMaxExpression : "",
  })
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="random" size="md" />}
        typeBadge={nodeData.subtitle ?? core.typeLabel}
        label={nodeData.label || "Random number"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
      >
        {/* Footer metadata — bound expressions as configured on the Inputs tab */}
        {metadataRows.length > 0 ? (
          <>
            <div className="h-px w-full bg-border/80" aria-hidden />
            <div className="px-3 pb-3 pt-2">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Metadata
              </p>
              <dl className="min-w-0 space-y-2 text-xs">
                {metadataRows.map((item) => (
                  <div
                    key={item.label}
                    className="flex min-w-0 items-start justify-between gap-x-3 gap-y-0.5 text-left"
                  >
                    <dt className="max-w-[40%] shrink-0 truncate text-muted-foreground">{item.label}</dt>
                    <dd className="min-w-0 flex-1 break-words text-right font-medium text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        ) : null}
      </BaseNode>
      <OutputHandle />
    </>
  )
}

/**
 * Reads configured min/max from the step's declared input schema for on-canvas summary.
 * Rows with blank trimmed values are omitted (same trimming rule as AI node metadata helpers).
 */
function buildRandomNumberCanvasMetadataRows({
  inputSchema,
  randomMinExpression,
  randomMaxExpression,
}: {
  inputSchema: unknown
  randomMinExpression: string
  randomMaxExpression: string
}): { label: string; value: string }[] {
  const fields = readInputSchemaFromNodeData({ value: inputSchema })
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const out: { label: string; value: string }[] = []

  const minRaw = randomMinExpression || byKey.get("min")?.value
  const maxRaw = randomMaxExpression || byKey.get("max")?.value
  const minStr = typeof minRaw === "string" ? minRaw.trim() : minRaw != null ? String(minRaw).trim() : ""
  const maxStr = typeof maxRaw === "string" ? maxRaw.trim() : maxRaw != null ? String(maxRaw).trim() : ""

  if (minStr.length > 0) {
    out.push({ label: "Min", value: minStr })
  }
  if (maxStr.length > 0) {
    out.push({ label: "Max", value: maxStr })
  }

  return out
}
