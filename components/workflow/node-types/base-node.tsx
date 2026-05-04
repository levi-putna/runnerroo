"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { NodeResult } from "@/lib/workflow/types"
import { WorkflowRunContext } from "@/lib/workflow/run-context"

/** Shared chrome for rectangular workflow nodes (matches canvas card styling). */
export const WORKFLOW_NODE_SURFACE =
  "rounded-lg bg-card w-[260px] cursor-pointer transition-all select-none overflow-hidden border border-border/70 shadow-[0_1px_2px_oklch(0_0_0/6%),0_4px_12px_oklch(0_0_0/5%)]"

/**
 * Pulse / outcome ring for observability — applied over {@link WORKFLOW_NODE_SURFACE}.
 */
export function workflowNodeRunRingClassName(status: NodeResult["status"] | undefined): string | null {
  if (status === "running") return "ring-4 ring-amber-400/95 animate-pulse shadow-[0_0_22px_oklch(76%_0.16_80_/_22%)]"
  if (status === "success") return "ring-4 ring-emerald-500 shadow-[0_0_14px_oklch(72%_0.17_150_/_20%)]"
  if (status === "failed") return "ring-4 ring-red-500 shadow-[0_0_14px_oklch(63%_0.22_25_/_25%)]"
  return null
}

/**
 * Preferred selection hover / outline when no run-status overlay is shown.
 */
export function workflowStepShellClassName({
  selected,
  runRingClassName,
}: {
  selected?: boolean
  /** Return value from {@link workflowNodeRunRingClassName}; null skips run styling. */
  runRingClassName?: string | null
}): string {
  const trimmed = typeof runRingClassName === "string" ? runRingClassName.trim() : ""
  if (trimmed) return trimmed
  if (selected) {
    return "ring-[6.75px] ring-blue-500/50 shadow-[0_8px_28px_oklch(0_0_0/12%)]"
  }
  return "hover:border-border hover:shadow-[0_4px_16px_oklch(0_0_0/8%)]"
}

/**
 * Reads persisted run visuals for one React Flow node id.
 */
export function useWorkflowNodeRunRingClassName(nodeId: string): string | null {
  const map = React.useContext(WorkflowRunContext)
  const latest = map.get(nodeId)
  return workflowNodeRunRingClassName(latest?.status)
}

interface BaseNodeProps {
  icon: React.ReactNode
  /** Short label shown in the grey pill under the title (e.g. "Request", "Trigger"). */
  typeBadge: string
  /** Primary heading; displayed in uppercase in the compact canvas card. */
  label: string
  description?: string
  /** Extra classes for the optional description paragraph (e.g. remove line clamp for long copy). */
  descriptionClassName?: string
  /** Hover, selection ring, or simulated run halo — typically {@link workflowStepShellClassName}. */
  shellClassName: string
  accentColor?: string
  children?: React.ReactNode
}

/**
 * Rectangular workflow step card: coloured type icon, uppercase title, type pill.
 * Description is rendered as compact plain text only when present (edit via the sheet).
 * Selection and run overlays are driven through `shellClassName` (see workflow step shell helpers below).
 */
export function BaseNode({
  icon,
  typeBadge,
  label,
  description,
  descriptionClassName,
  shellClassName,
  accentColor = "bg-slate-500",
  children,
}: BaseNodeProps) {
  const descriptionText = (typeof description === "string" ? description : description != null ? String(description) : "").trim()

  return (
    <div
      className={cn(
        WORKFLOW_NODE_SURFACE,
        shellClassName,
      )}
    >

      {/* Header — icon tile + title column */}
      <div className="flex gap-3 px-3 pt-3 pb-2">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md shadow-inner",
            accentColor
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-wide leading-tight truncate text-foreground">
            {label}
          </p>
          {/* Step kind pill */}
          <span className="mt-1 inline-flex max-w-full items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground truncate">
            {typeBadge}
          </span>
        </div>
      </div>

      {/* Body — plain description only when set (no inline field — saves canvas space) */}
      {descriptionText ? (
        <>
          <div className="h-px w-full bg-border/80" />
          <div className="px-3 pb-3 pt-2">
            <p
              className={cn(
                "text-xs text-muted-foreground leading-snug whitespace-pre-wrap break-words",
                descriptionClassName ?? "line-clamp-4",
              )}
            >
              {descriptionText}
            </p>
          </div>
        </>
      ) : null}

      {children}
    </div>
  )
}
