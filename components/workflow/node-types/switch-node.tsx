"use client"

import * as React from "react"
import { Position, type NodeProps, useUpdateNodeInternals } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { resolveWorkflowNodeTilePresentation } from "@/lib/workflow/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { InputHandle, WorkflowSourceHandle } from "./handles"
import { WORKFLOW_NODE_SURFACE } from "./base-node"

/** One guarded exit from a switch — evaluated top-to-bottom; first match wins at runtime. */
export interface SwitchBranch {
  id: string
  label?: string
  condition?: string
}

export interface SwitchNodeData {
  label: string
  description?: string
  branches?: SwitchBranch[]
  defaultBranchLabel?: string
  [key: string]: unknown
}

/**
 * Fixed row height (h-11 = 44px) — used to calculate handle `top` offsets
 * for each branch without needing DOM measurements per row.
 */
const ROW_H = 44

/**
 * Routes flow to exactly one outbound path: first matching case, else the default exit.
 *
 * Handles are absolute children of the outer `relative` wrapper, placed OUTSIDE the
 * `overflow:hidden` card — same pattern as DecisionNode's sibling `h-0` div.
 * `right: -5` mirrors `bottom: -5` used by every other source handle in the graph.
 */
export function SwitchNode({ id, data, selected }: NodeProps) {
  const nodeData = data as SwitchNodeData
  const descriptionText = nodeData.description?.trim()
  const branches = nodeData.branches?.length
    ? nodeData.branches
    : [{ id: "initial-case", label: "Case 1", condition: "" }]
  const defaultLabel = nodeData.defaultBranchLabel ?? "Else"
  const { accentBg: switchAccentBg } = resolveWorkflowNodeTilePresentation({ type: "switch" })

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
            : "hover:border-border hover:shadow-[0_4px_16px_oklch(0_0_0/8%)]"
        )}
      >
        {/* Header — measured via ResizeObserver so handles stay aligned when description reflows */}
        <div ref={headerRef}>

          <div className="flex gap-4 px-3 pt-4 pb-2">
            <div className="relative flex size-[52px] shrink-0 items-center justify-center">
              <div
                className={cn(
                  "size-11 rounded-xl shadow-[0_6px_16px_oklch(62%_0.14_180_/_35%)]",
                  switchAccentBg,
                )}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <WorkflowNodeGlyph type="switch" size="hero" />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="text-[13px] font-semibold uppercase tracking-wide leading-tight text-foreground">
                {nodeData.label || "Switch"}
              </p>
              <span className="mt-2 inline-flex w-fit rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Switch
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

        {/* Case rows — fixed h-11 so handle tops are predictable */}
        <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
          {branches.map((b, idx) => (
            <div
              key={b.id}
              className="flex h-11 shrink-0 items-center gap-2 bg-muted/20 pl-3 pr-10"
            >
              <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tabular-nums text-muted-foreground">
                {idx + 1}.
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-xs font-semibold text-foreground">
                  {b.label || `Case ${idx + 1}`}
                </p>
                {b.condition?.trim() ? (
                  <code className="w-full truncate rounded-md border border-dashed border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {b.condition}
                  </code>
                ) : (
                  <span className="text-[10px] italic text-muted-foreground">No condition yet</span>
                )}
              </div>
            </div>
          ))}

          {/* Default row */}
          <div className="flex h-11 shrink-0 items-center gap-2 border-t border-dashed border-border/70 bg-slate-500/8 pl-3 pr-10">
            <span className="w-10 shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
              Default
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-xs font-semibold text-foreground">{defaultLabel}</p>
              <span className="text-[10px] text-muted-foreground">If no case matches</span>
            </div>
          </div>
        </div>
      </div>

      {/* Exit handles — absolute children of the outer `relative` wrapper.
          Never inside the card so overflow:hidden never clips them.
          `right: -5` matches `bottom: -5` used by every other source handle. */}
      {branches.map((b, idx) => (
        <WorkflowSourceHandle
          key={b.id}
          id={`case-${b.id}`}
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

      {/* Default exit handle — below all case rows */}
      <WorkflowSourceHandle
        id="default"
        position={Position.Right}
        switchExit
        style={{
          top: headerH + branches.length * ROW_H + ROW_H / 2,
          right: -5,
          transform: "translateY(-50%)",
          position: "absolute",
        }}
      />
    </div>
  )
}
