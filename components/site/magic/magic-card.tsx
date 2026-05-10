"use client"

import type { CSSProperties, ReactNode } from "react"
import { useCallback, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Spotlight gradient card inspired by Magic UI Magic Card (https://magicui.design/docs/components/magic-card).
 */
export function MagicCard({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [glow, setGlow] = useState({ x: 50, y: 50, active: false })

  const onMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    setGlow({ x, y, active: true })
  }, [])

  const onLeave = useCallback(() => {
    setGlow((prev) => ({ ...prev, active: false }))
  }, [])

  const style = {
    "--site-magic-x": `${glow.x}%`,
    "--site-magic-y": `${glow.y}%`,
  } as CSSProperties

  return (
    <div
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-sm backdrop-blur-sm",
        className,
      )}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      style={style}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300",
          "bg-[radial-gradient(600px_circle_at_var(--site-magic-x)_var(--site-magic-y),color-mix(in_oklch,var(--primary)_22%,transparent),transparent_55%)]",
          glow.active ? "opacity-100" : "group-hover:opacity-70",
        )}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
