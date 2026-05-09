import { DateTime } from "luxon"
import { CronExpressionParser } from "cron-parser"

/**
 * Determines whether `expression` fires during the calendar minute containing `tick` in `timezone`.
 *
 * Supabase Cron (pg_cron) typically invokes Net HTTP payloads once per invocation; aligning with a wall-clock minute
 * keeps runs stable when Postgres fires within the same sixty-second bucket.
 *
 * ## Format
 *
 * Accepts conventional five-part cron expressions (minute hour DOM month dow). Invalid expressions yield `false`.
 */
export function isScheduleDueForTick({
  expression,
  timezone,
  tick,
}: {
  expression: string
  timezone: string
  tick: Date
}): boolean {
  const zone = timezone.trim() !== "" ? timezone.trim() : "UTC"
  if (expression.trim() === "") return false

  try {
    const dt = DateTime.fromJSDate(tick, { zone: "utc" }).setZone(zone)
    if (!dt.isValid) {
      return false
    }

    const minuteStart = dt.startOf("minute")
    const minuteEnd = dt.endOf("minute")

    const interval = CronExpressionParser.parse(expression, {
      currentDate: minuteEnd.toJSDate(),
      tz: zone,
    })
    const prev = interval.prev().toDate()
    const startMs = minuteStart.toMillis()
    const endMs = minuteEnd.toMillis()
    const prevMs = prev.getTime()
    return prevMs >= startMs && prevMs <= endMs
  } catch {
    return false
  }
}
