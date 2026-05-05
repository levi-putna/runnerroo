import * as React from "react"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"

interface PageHeaderProps {
  /** The primary page title. */
  title: string
  /** Optional subtitle shown beneath the title. */
  description?: string
  /** Actions rendered on the right-hand side of the header. */
  children?: React.ReactNode
  className?: string
}

/**
 * Reusable page-level header with sidebar trigger, title/description on the left,
 * and an optional actions slot + theme toggle on the right.
 *
 * Usage:
 *   <PageHeader title="Workflows" description="Build and automate your processes">
 *     <Button>New workflow</Button>
 *   </PageHeader>
 */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-b px-3 py-2",
        className
      )}
    >
      {/* Sidebar trigger */}
      <SidebarTrigger className="size-7 shrink-0 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-4 shrink-0" />

      {/* Title + description */}
      <div className="min-w-0 flex-1 py-1">
        <h1 className="text-sm font-semibold leading-tight tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{description}</p>
        )}
      </div>

      {/* Actions */}
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}

      {/* Theme toggle */}
      <ThemeToggle />
    </div>
  )
}
