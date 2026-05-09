"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface WorkflowEditableListRowProps {
  /** Row body placed in the primary tap target (label stack, keys, …). */
  children: React.ReactNode
  /** Optional leading control — e.g. drag handle — sits outside the main tap target. */
  leading?: React.ReactNode
  /** Optional trailing controls — e.g. delete — sit to the left of the chevron; hidden until row hover/focus-within. */
  trailing?: React.ReactNode
  /** When true, shows a muted chevron after optional trailing controls (stack navigation affordance). */
  showChevron?: boolean
  /** Primary tap action; when omitted, children render inside a non-interactive flex region. */
  onActivate?: () => void
  /** When true, removes row focus-within ring and main tap target focus ring (e.g. dense switch-case lists). */
  suppressFocusChrome?: boolean
  className?: string
}

/**
 * Chevron and optional trailing controls; delete stays immediately left of the chevron when both exist.
 */
function WorkflowEditableListRowRail({
  trailing,
  showChevron,
  onActivate,
}: {
  trailing?: React.ReactNode
  showChevron: boolean
  onActivate?: () => void
}) {
  if (!trailing && !showChevron) return null

  return (
    <div className="flex shrink-0 items-center gap-0 pr-2">
      {/* Destructive / secondary actions — only visible on row hover or when focus is inside the row */}
      {trailing ? (
        <div
          className={cn(
            "flex items-center opacity-0 pointer-events-none transition-opacity duration-150",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          )}
        >
          {trailing}
        </div>
      ) : null}
      {showChevron ? (
        onActivate != null ? (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted/40"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onActivate()
            }}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )
      ) : null}
    </div>
  )
}

/**
 * Shared row chrome for workflow lists that drill into a detail pane (schema fields, switch cases, …).
 * Mirrors the collapsed Input schema row: bordered surface, hover, optional grip + chevron.
 */
export function WorkflowEditableListRow({
  children,
  leading,
  trailing,
  showChevron = false,
  onActivate,
  suppressFocusChrome = false,
  className,
}: WorkflowEditableListRowProps) {
  /** Extra gutter between grip and row chrome reads heavy — tuck body closer when a leading handle exists */
  const bodyHorizontalPadding = leading ? "pl-2 pr-3" : "px-3"

  const activateButtonClassName = cn(
    "flex min-w-0 flex-1 items-center gap-3 bg-transparent py-2.5 text-left transition-colors hover:bg-transparent focus-visible:outline-none",
    suppressFocusChrome
      ? "focus-visible:ring-0"
      : "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    bodyHorizontalPadding,
  )

  const passiveBodyClassName = cn(
    "flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left transition-colors",
    bodyHorizontalPadding,
  )

  return (
    <div
      className={cn(
        "group flex min-w-0 w-full items-stretch rounded-lg border border-border/70 bg-background",
        suppressFocusChrome ? "outline-none" : "focus-within:ring-2 focus-within:ring-ring",
        leading ? "gap-0" : "gap-1",
        className,
      )}
    >
      {leading ? <div className="flex shrink-0 items-stretch">{leading}</div> : null}
      {onActivate != null ? (
        <div className="flex min-w-0 flex-1 items-stretch transition-colors hover:bg-muted/30">
          {/* Primary navigate target — body only so trailing delete stays a sibling button */}
          <button type="button" onClick={onActivate} className={activateButtonClassName}>
            <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
          </button>
          <WorkflowEditableListRowRail trailing={trailing} showChevron={showChevron} onActivate={onActivate} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-stretch">
          <div className={cn(passiveBodyClassName, "flex min-w-0 flex-1 items-center")}>
            <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
          </div>
          <WorkflowEditableListRowRail trailing={trailing} showChevron={showChevron} onActivate={undefined} />
        </div>
      )}
    </div>
  )
}
