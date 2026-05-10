import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type LineShadowTextTag = "h1" | "h2" | "span" | "p"

/**
 * Display headline with soft extruded shadow, inspired by Magic UI Line Shadow Text (https://magicui.design/docs/components/line-shadow-text).
 */
export function LineShadowText({
  className,
  children,
  as: Tag = "span",
}: {
  className?: string
  children: ReactNode
  as?: LineShadowTextTag
}) {
  return (
    <Tag
      className={cn(
        "relative inline-block bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text font-semibold tracking-tight text-transparent",
        "drop-shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_18%,transparent)]",
        className,
      )}
    >
      {children}
    </Tag>
  )
}
