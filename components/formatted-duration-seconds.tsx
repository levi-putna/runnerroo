import { cn } from "@/lib/utils"
import { formatDurationFromSeconds } from "@/lib/format-duration-from-seconds"

type FormattedDurationSecondsProps = {
  seconds: number
  className?: string
}

/**
 * Presents elapsed time from fractional seconds using tiered units (seconds alone, then min, hour, day).
 */
export function FormattedDurationSeconds({ seconds, className }: FormattedDurationSecondsProps) {
  return (
    <span className={cn("tabular-nums", className)}>{formatDurationFromSeconds(seconds)}</span>
  )
}
