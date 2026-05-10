"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Lightweight orbiting icon ring inspired by Magic UI Orbiting Circles (https://magicui.design/docs/components/orbiting-circles).
 */
export function OrbitingIcons({
  className,
  icons,
}: {
  className?: string
  icons: LucideIcon[]
}) {
  return (
    <div className={cn("relative flex size-[min(100vw-2rem,320px)] items-center justify-center", className)}>
      <div
        aria-hidden
        className="absolute inset-6 rounded-full border border-dashed border-border/60"
      />
      <div className="relative z-[1] flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
        <span className="font-mono text-xs text-muted-foreground">AI</span>
      </div>
      <div className="pointer-events-none absolute inset-0 animate-site-orbit-spin">
        {icons.map((Icon, index) => {
          const angle = (360 / icons.length) * index
          return (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
              style={{
                transform: `rotate(${angle}deg) translateY(-118px) rotate(-${angle}deg)`,
              }}
            >
              <Icon className="size-4 text-primary" aria-hidden />
            </div>
          )
        })}
      </div>
    </div>
  )
}
