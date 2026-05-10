"use client"

import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Animated conic-gradient border inspired by Magic UI Shine Border (https://magicui.design/docs/components/shine-border).
 */
export function ShineBorder({
  className,
  children,
  borderRadius = 12,
  borderWidth = 1,
  duration = 14,
}: {
  className?: string
  children: ReactNode
  borderRadius?: number
  borderWidth?: number
  duration?: number
}) {
  const style = {
    "--site-shine-radius": `${borderRadius}px`,
    "--site-shine-width": `${borderWidth}px`,
    "--site-shine-duration": `${duration}s`,
  } as CSSProperties

  return (
    <div
      className={cn("relative overflow-hidden rounded-[var(--site-shine-radius)] p-[var(--site-shine-width)]", className)}
      style={style}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[var(--site-shine-radius)] opacity-90",
          "bg-[conic-gradient(from_0deg,transparent_0deg,color-mix(in_oklch,var(--primary)_55%,transparent)_120deg,transparent_240deg)]",
          "motion-reduce:animate-none animate-site-shine-spin",
        )}
        style={{ animationDuration: "var(--site-shine-duration)" }}
      />
      <div className="relative rounded-[calc(var(--site-shine-radius)-var(--site-shine-width))] bg-card text-card-foreground">
        {children}
      </div>
    </div>
  )
}
