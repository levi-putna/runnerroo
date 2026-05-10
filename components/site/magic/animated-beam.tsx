"use client"

import { useId, useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

/**
 * Subscribes to `prefers-reduced-motion` changes for {@link useSyncExternalStore}.
 */
function subscribePrefersReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

/**
 * Client snapshot for reduced-motion preference.
 */
function getPrefersReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * SSR-safe default — assume motion is allowed until hydration.
 */
function getPrefersReducedMotionServerSnapshot() {
  return false
}

/**
 * SVG beam animation between two horizontal anchors, inspired by Magic UI Animated Beam (https://magicui.design/docs/components/animated-beam).
 */
export function AnimatedBeam({
  className,
  fromX = 12,
  toX = 88,
  y = 50,
}: {
  className?: string
  /** Start X in viewBox units (0–100). */
  fromX?: number
  /** End X in viewBox units (0–100). */
  toX?: number
  /** Y in viewBox units (0–100). */
  y?: number
}) {
  const rawId = useId()
  const gradientId = `site-beam-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const reduceMotion = useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotionSnapshot,
    getPrefersReducedMotionServerSnapshot,
  )

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M ${fromX} ${y} L ${toX} ${y}`}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        fill="none"
        className={reduceMotion ? "opacity-70" : "animate-site-beam-dash"}
        style={
          reduceMotion
            ? undefined
            : {
                strokeDasharray: "10 22",
              }
        }
      />
    </svg>
  )
}
