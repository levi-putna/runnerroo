"use client"

import * as React from "react"
import type { NodeProps } from "@xyflow/react"
import { useNodeId, useReactFlow } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"
import {
  WORKFLOW_NODE_SURFACE,
  useWorkflowNodeRunRingClassName,
} from "@/lib/workflows/steps/shared/base-node"

export interface CodeNodeData {
  label: string
  description?: string
  language?: "javascript" | "typescript" | "python"
  code?: string
  [key: string]: unknown
}

const CODE_META = WORKFLOW_NODE_CORE_META.code

const LABELS: Record<NonNullable<CodeNodeData["language"]>, string> = {
  javascript: "JS",
  typescript: "TS",
  python: "PY",
}

/**
 * Keeps snippet edits inside the compact node card.
 */
function CodeBodyField({ value }: { value?: string }) {
  const id = useNodeId()
  const { setNodes } = useReactFlow()

  function persist(next: string) {
    if (!id) return
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, code: next } } : n))
    )
  }

  const lines = React.useMemo(
    () => (value ?? "").split("\n").slice(0, 8),
    [value]
  )

  return (
    <div className="rounded-md border border-border/70 bg-muted/25 overflow-hidden">
      <textarea
        value={value ?? ""}
        onChange={(e) => persist(e.target.value)}
        spellCheck={false}
        rows={Math.min(Math.max(lines.length, 4), 8)}
        className={cn(
          "nodrag nopan min-h-[88px] w-full resize-none bg-transparent px-2 py-2",
          "text-[11px] leading-snug font-mono text-foreground/90 outline-none"
        )}
      />
    </div>
  )
}

export function CodeNode({ id, data, selected }: NodeProps) {
  const nodeData = data as CodeNodeData
  const lang = nodeData.language ?? "typescript"
  const mono = LABELS[lang]
  const descriptionText = nodeData.description?.trim()
  const runRing = useWorkflowNodeRunRingClassName(id)
  /** Code step keeps tinted selection chrome unless a simulated run overlays it */
  const selectionAndRunShell =
    runRing ??
    (selected
      ? "ring-2 ring-primary/35 shadow-[0_0_0_1px_var(--workflow-node-selected,_oklch(0.55_0.15_252)),0_8px_28px_oklch(0_0_0/12%)]"
      : "hover:border-border hover:shadow-[0_4px_16px_oklch(0_0_0/8%)]")

  return (
    <>
      <InputHandle />
      {/* Code step — header row, divider, optional description as text, monospace body */}
      <div
        className={cn(WORKFLOW_NODE_SURFACE, "w-[300px]", selectionAndRunShell)}
        style={
          selected && !runRing
            ? ({ "--workflow-node-selected": CODE_META.accentHex } as React.CSSProperties)
            : undefined
        }
      >
        {selected && (
          <div className="h-0.5 w-full" style={{ background: CODE_META.accentHex }} />
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-3 pt-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <WorkflowNodeIconTile
              type="code"
              size="md"
              frameClassName="flex size-9 shrink-0 items-center justify-center rounded-md shadow-inner"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-wide truncate">
                {nodeData.label || "Run code"}
              </p>
              <span className="mt-1 block truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                {CODE_META.typeLabel}
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] font-medium uppercase text-muted-foreground">
            {mono}
          </span>
        </div>

        {/* Divider — body always contains the code tray */}
        <div className="h-px w-full bg-border/80 mt-3" />

        {/* Body */}
        <div className="px-3 pb-3 pt-2 space-y-2">
          {/* Plain description only when set */}
          {descriptionText ? (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-3 whitespace-pre-wrap break-words">
              {descriptionText}
            </p>
          ) : null}
          <CodeBodyField value={nodeData.code} />
        </div>
      </div>
      <OutputHandle />
    </>
  )
}
