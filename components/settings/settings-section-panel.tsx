"use client"

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type SettingsSectionPanelProps = {
  id?: string
  /** Optional Playwright hook on the outer card. */
  dataTestId?: string
  icon: LucideIcon
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
  /** Optional short hint in the footer strip (left, with actions on the right). */
  footerHint?: React.ReactNode
  /** Actions in the footer row (right-aligned as a group). */
  footerActions?: React.ReactNode
}

/**
 * Settings section shell matching workflow schema / builder panels: bordered card, branded header strip, body, footer.
 */
export function SettingsSectionPanel({
  id,
  dataTestId,
  icon: Icon,
  title,
  subtitle,
  children,
  footerHint,
  footerActions,
}: SettingsSectionPanelProps) {
  const showFooter = footerHint != null || footerActions != null

  return (
    <div
      id={id}
      data-testid={dataTestId}
      className="min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40"
    >
      {/* Header — matches InputSchemaBuilder / workflow panel shell */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background"
          aria-hidden
        >
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">{title}</p>
          <div className="text-xs text-muted-foreground leading-relaxed">{subtitle}</div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 px-4 pb-4 pt-3">{children}</div>

      {showFooter ? (
        <div className="flex items-start justify-between gap-4 border-t border-border/70 bg-muted/10 px-4 py-3">
          {/* Hint — allowed to wrap; min-w-0 lets it shrink below its content size */}
          {footerHint ? (
            <p className="min-w-0 flex-1 text-xs text-muted-foreground leading-relaxed">{footerHint}</p>
          ) : (
            <span aria-hidden />
          )}
          {/* Actions — shrink-0 keeps the button on the right and prevents it collapsing */}
          {footerActions ? (
            <div className="flex shrink-0 items-center gap-2">{footerActions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
