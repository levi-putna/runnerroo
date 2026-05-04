"use client"

import * as React from "react"
import { Position, type NodeProps, useUpdateNodeInternals } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { resolveWorkflowNodeTilePresentation } from "@/lib/workflow/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { InputHandle, WorkflowSourceHandle } from "./handles"
import { WORKFLOW_NODE_SURFACE } from "./base-node"

/** One parallel exit from a split — each receives the same upstream payload at runtime. */
export interface SplitPath {
  id: string
  label?: string
}

export interface SplitNodeData {
  label: string
  description?: string
  paths?: SplitPath[]
  [key: string]: unknown
}

/**
 * Fixed row height (h-11 = 44px) — used to calculate handle `top` offsets
 * for each path without needing DOM measurements per row.
 */
const ROW_H = 44

/**
 * Fans the inbound payload out to every connected outbound path with no branching logic.
 * Each exit handle carries an identical copy of the input for downstream steps.
 */
export function SplitNode({ id, data, selected }: NodeProps) {
  const nodeData = data as SplitNodeData
  const descriptionText = nodeData.description?.trim()
  const paths = nodeData.paths?.length
    ? nodeData.paths
    : [
        { id: "sp-a", label: "Path A" },
        { id: "sp-b", label: "Path B" },
      ]
  const { accentBg: splitAccentBg } = resolveWorkflowNodeTilePresentation({ type: "split" })

  const headerRef = React.useRef<HTMLDivElement>(null)
  const [headerH, setHeaderH] = React.useState(0)
  const updateNodeInternals = useUpdateNodeInternals()

  /** Re-measure header whenever it resizes (description/label text reflow, selection bar). */
  React.useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setHeaderH(el.offsetHeight)
      updateNodeInternals(id)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [id, updateNodeInternals])

  return (
    /* Outer wrapper is the positioned ancestor for ALL handles */
    <div className="relative w-[300px]">
      <InputHandle />

      {/* Card — overflow:hidden is safe here, no handles live inside */}
      <div
        className={cn(
          WORKFLOW_NODE_SURFACE,
          "w-full",
          selected
            ? "ring-[6.75px] ring-blue-500/50 shadow-[0_8px_28px_oklch(0_0_0/12%)]"
            : "hover:border-border hover:shadow-[0_4px_16px_oklch(0_0_0/8%)]",
        )}
      >
        {/* Header — measured via ResizeObserver so handles stay aligned when description reflows */}
        <div ref={headerRef}>
          {/* Title row: glyph + label + type pill */}
          <div className="flex gap-4 px-3 pt-4 pb-2">
            <div className="relative flex size-[52px] shrink-0 items-center justify-center">
              <div
                className={cn(
                  "size-11 rounded-xl shadow-[0_6px_16px_oklch(62%_0.14_200_/_35%)]",
                  splitAccentBg,
                )}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <WorkflowNodeGlyph type="split" size="hero" />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="text-[13px] font-semibold uppercase tracking-wide leading-tight text-foreground">
                {nodeData.label || "Split"}
              </p>
              <span className="mt-2 inline-flex w-fit rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Split
              </span>
              {descriptionText ? (
                <p className="mt-2 text-xs text-muted-foreground leading-snug line-clamp-3 whitespace-pre-wrap break-words">
                  {descriptionText}
                </p>
              ) : null}
            </div>
          </div>

          <div className="h-px w-full bg-border/80" />
        </div>

        {/* Path rows — fixed h-11 so handle tops are predictable */}
        <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
          {paths.map((p, idx) => (
            <div
              key={p.id}
              className="flex h-11 shrink-0 items-center gap-2 bg-muted/20 pl-3 pr-10"
            >
              <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tabular-nums text-muted-foreground">
                {idx + 1}.
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-xs font-semibold text-foreground">
                  {p.label || `Path ${idx + 1}`}
                </p>
                <span className="text-[10px] text-muted-foreground">Same payload as input</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exit handles — absolute siblings; `right: -5` matches other source handles */}
      {paths.map((p, idx) => (
        <WorkflowSourceHandle
          key={p.id}
          id={`path-${p.id}`}
          position={Position.Right}
          switchExit
          style={{
            top: headerH + idx * ROW_H + ROW_H / 2,
            right: -5,
            transform: "translateY(-50%)",
            position: "absolute",
          }}
        />
      ))}
    </div>
  )
}
