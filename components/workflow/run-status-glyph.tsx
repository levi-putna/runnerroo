"use client"

import { CircleCheck, CircleX, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Database } from "@/types/database"

type RunStatus = Database["public"]["Tables"]["workflow_runs"]["Row"]["status"]

export interface RunStatusGlyphProps {
  status: RunStatus
  className?: string
}

/**
 * Compact status icon for workflow run rows (success, failure, in progress).
 */
export function RunStatusGlyph({ status, className }: RunStatusGlyphProps) {
  if (status === "success") {
    return (
      <CircleCheck
        aria-hidden
        className={cn("size-4 text-emerald-600 dark:text-emerald-400", className)}
      />
    )
  }
  if (status === "failed" || status === "cancelled") {
    return (
      <CircleX aria-hidden className={cn("size-4 text-red-600 dark:text-red-400", className)} />
    )
  }
  return (
    <Loader2 aria-hidden className={cn("size-4 text-amber-500 animate-spin", className)} />
  )
}
