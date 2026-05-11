import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Centres documentation copy with a readable measure (React Flow Learn–style column).
 * Pass `titleLeading` for a canvas-style workflow tile to the left of the heading (same chrome as the node sheet).
 */
export function LearnArticle({
  title,
  description,
  children,
  className,
  hero,
  titleLeading,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  /** Optional visual block directly under the title (e.g. diagrams). */
  hero?: ReactNode
  /** Optional element to the left of the title row (e.g. canvas-style step icon tile). */
  titleLeading?: ReactNode
}) {
  return (
    <article className={cn("mx-auto max-w-3xl", className)}>
      {/* Title block: optional step tile left; heading beside it (matches sheet header chrome) */}
      <header className="mb-10 border-b border-border/60 pb-8">
        <div className="flex min-h-12 items-center gap-4">
          {titleLeading ? <div className="not-prose shrink-0">{titleLeading}</div> : null}
          <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        {description ? (
          <p className="mt-3 text-base text-muted-foreground">{description}</p>
        ) : null}
      </header>

      {/* Optional hero: full width of article column */}
      {hero ? <div className="mb-10 w-full">{hero}</div> : null}

      {/* Body */}
      <div className="site-markdown space-y-4 text-foreground">{children}</div>
    </article>
  )
}
