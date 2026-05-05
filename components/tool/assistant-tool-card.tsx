import { AlertTriangle, Ban, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import React from "react"

export type AssistantToolCardVariant = "success" | "denied" | "error" | "loading"

export type AssistantToolCardProps = {
  /** Title text displayed in the header */
  title: string
  /** Icon component to render as the primary icon */
  icon?: LucideIcon
  /** Optional action buttons or controls for header */
  headerActions?: React.ReactNode
  /** Body content to display in the card */
  children: React.ReactNode
  /** Card variant state */
  variant?: AssistantToolCardVariant
  /** Optional data-testid for the root element */
  testId?: string
  /** Optional meta text displayed to the left of the status icon */
  meta?: string
}

/**
 * Standardised card structure used across assistant tool states: header (icon, title, status)
 * and body. Clicking the title strip toggles expand/collapse; header actions do not.
 */
export function AssistantToolCard({
  title,
  icon: Icon,
  headerActions,
  children,
  variant,
  testId,
  meta,
}: AssistantToolCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [isHovered, setIsHovered] = React.useState(false)

  React.useEffect(() => {
    if (variant === "success" || variant === "denied") {
      setIsExpanded(false)
    }
  }, [variant])

  const getBorderClasses = () => {
    switch (variant) {
      case "success":
        return "border border-border"
      case "denied":
        return "border border-amber-500/70 dark:border-amber-400/70"
      case "error":
        return "border border-destructive"
      default:
        return "border border-border"
    }
  }

  const getStatusIcon = () => {
    switch (variant) {
      case "success":
        return null
      case "denied":
        return <Ban size={14} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />
      case "error":
        return <AlertTriangle size={14} className="text-destructive flex-shrink-0" />
      case "loading":
        return <Loader2 size={14} className="text-muted-foreground/70 flex-shrink-0 animate-spin" />
      default:
        return null
    }
  }

  const borderClasses = getBorderClasses()
  const statusIcon = getStatusIcon()

  const handleHeaderClick = () => {
    setIsExpanded((prev) => !prev)
  }

  /**
   * Expands/collapses the card when the title row is activated via keyboard.
   */
  const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleHeaderClick()
    }
  }

  return (
    <div
      className="text-sm w-full"
      data-testid={testId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`${borderClasses} rounded-lg overflow-hidden w-full bg-sidebar p-2 flex flex-col gap-2`}>
        {/* Header: left = expand toggle only; right = meta/actions/status (no toggle) */}
        <div className="flex min-w-0 items-center justify-between gap-2 px-1 transition-colors">
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={handleHeaderClick}
            onKeyDown={handleHeaderKeyDown}
          >
            {isHovered ? (
              isExpanded ? (
                <ChevronUp size={14} className="flex-shrink-0 text-muted-foreground/70" />
              ) : (
                <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground/70" />
              )
            ) : (
              Icon && <Icon size={14} className="flex-shrink-0 text-muted-foreground/70" />
            )}
            <span className="truncate text-muted-foreground">{title}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {meta ? <span className="text-xs text-muted-foreground/70">{meta}</span> : null}
            {headerActions ? headerActions : null}
            {statusIcon}
          </div>
        </div>

        {/* Body: nested panel with bg-background to mirror table inner content style */}
        {isExpanded ? (
          <div className="rounded-md border border-border bg-background overflow-hidden">
            <div className="p-3 space-y-2">{children}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
