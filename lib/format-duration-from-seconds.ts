const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR
const HOURS_PER_DAY = 24
const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY

/**
 * Builds a fractional seconds suffix for durations under one minute with up to three significant figures but no trailing-noise tails.
 */
function formatSubMinuteSeconds(seconds: number): string {
  if (seconds < 10) {
    return `${Number(seconds.toFixed(2))}`
  }
  if (seconds < 60) {
    return `${Number(seconds.toFixed(1))}`
  }
  return `${Math.floor(seconds)}`
}

/**
 * Formats an elapsed interval given in seconds into tiered units: seconds alone under a minute,
 * then minutes + seconds under an hour, then hours through to days for longer spans.
 *
 * Intended for durations (not clocks), aligned with concise run observability copy.
 */
export function formatDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0 s"
  }

  /** Only the shortest tier uses fractional seconds so longer spans stay tidy whole numbers */
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${formatSubMinuteSeconds(totalSeconds)} s`
  }

  const whole = Math.floor(totalSeconds)

  if (whole < SECONDS_PER_HOUR) {
    const m = Math.floor(whole / SECONDS_PER_MINUTE)
    const s = whole % SECONDS_PER_MINUTE
    return `${m} min ${s} s`
  }

  if (whole < SECONDS_PER_DAY) {
    const h = Math.floor(whole / SECONDS_PER_HOUR)
    const rem = whole % SECONDS_PER_HOUR
    const min = Math.floor(rem / SECONDS_PER_MINUTE)
    const s = rem % SECONDS_PER_MINUTE
    return `${h} h ${min} min ${s} s`
  }

  const d = Math.floor(whole / SECONDS_PER_DAY)
  const remDay = whole % SECONDS_PER_DAY
  const h = Math.floor(remDay / SECONDS_PER_HOUR)
  const remHour = remDay % SECONDS_PER_HOUR
  const min = Math.floor(remHour / SECONDS_PER_MINUTE)
  const s = remHour % SECONDS_PER_MINUTE
  return `${d} d ${h} h ${min} min ${s} s`
}
