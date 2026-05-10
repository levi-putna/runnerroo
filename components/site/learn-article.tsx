import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Centres documentation copy with a readable measure (React Flow Learn–style column).
 */
export function LearnArticle({
  title,
  description,
  children,
  className,
  hero,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  /** Optional visual block directly under the title (e.g. diagrams). */
  hero?: ReactNode
}) {
  return (
    <article className={cn("mx-auto max-w-3xl", className)}>
      {/* Title block */}
      <header className="mb-10 border-b border-border/60 pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-3 text-base text-muted-foreground">{description}</p>
        ) : null}
      </header>

      {/* Optional hero — full width of article column */}
      {hero ? <div className="mb-10 w-full">{hero}</div> : null}

      {/* Body */}
      <div className="site-markdown space-y-4 text-foreground">{children}</div>
    </article>
  )
}
