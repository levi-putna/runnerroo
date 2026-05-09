/**
 * Helpers for turning friendly schedule choices into UNIX five-part cron expressions
 * (`minute hour day-of-month month day-of-week`) and back — used by the CronExpressionBuilder UI.
 */

/** Discriminant for the “simple” schedule templates shown to non-experts. */
export type CronSimpleKind =
  | "every_minute"
  | "every_n_minutes"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "custom"

/** Parsed shape backing the simple-builder controls; `custom` retains the raw string for advanced edits. */
export type CronSimpleState =
  | { kind: "every_minute" }
  | { kind: "every_n_minutes"; n: 5 | 10 | 15 | 30 }
  | { kind: "hourly"; minute: number }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekdays"; hour: number; minute: number }
  | { kind: "weekly"; hour: number; minute: number; /** Cron weekdays: 0 Sun … 6 Sat */
      daysCron: number[] }
  | { kind: "monthly"; hour: number; minute: number; dayOfMonth: number }
  | { kind: "custom"; expression: string }

const N_MINUTES = new Set<number>([5, 10, 15, 30])

/**
 * Validates minute / hour integers for cron field generation.
 */
function clampInt({ value, min, max }: { value: number; min: number; max: number }): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** Splits an expression into five cron fields — returns null when malformed. */
function splitCronFields({ expression }: { expression: string }): string[] | null {
  const trimmed = expression.trim().replace(/\s+/g, " ")
  const parts = trimmed.split(" ")
  if (parts.length !== 5) return null
  return parts.map((p) => p.trim())
}

/**
 * Encodes {@link CronSimpleState} into a five-part UNIX cron string.
 */
export function cronExpressionFromSimpleState({ state }: { state: CronSimpleState }): string {
  switch (state.kind) {
    case "every_minute":
      return "* * * * *"
    case "every_n_minutes":
      return `*/${state.n} * * * *`
    case "hourly":
      return `${clampInt({ value: state.minute, min: 0, max: 59 })} * * * *`
    case "daily": {
      const m = clampInt({ value: state.minute, min: 0, max: 59 })
      const h = clampInt({ value: state.hour, min: 0, max: 23 })
      return `${m} ${h} * * *`
    }
    case "weekdays": {
      const m = clampInt({ value: state.minute, min: 0, max: 59 })
      const h = clampInt({ value: state.hour, min: 0, max: 23 })
      return `${m} ${h} * * 1-5`
    }
    case "weekly": {
      const m = clampInt({ value: state.minute, min: 0, max: 59 })
      const h = clampInt({ value: state.hour, min: 0, max: 23 })
      let days = [...new Set(state.daysCron.map((d) => clampInt({ value: d, min: 0, max: 6 })))].sort(
        (a, b) => a - b,
      )
      if (days.length === 0) days = [1]
      return `${m} ${h} * * ${days.join(",")}`
    }
    case "monthly": {
      const m = clampInt({ value: state.minute, min: 0, max: 59 })
      const h = clampInt({ value: state.hour, min: 0, max: 23 })
      const dom = clampInt({ value: state.dayOfMonth, min: 1, max: 31 })
      return `${m} ${h} ${dom} * *`
    }
    default:
      return state.expression.trim() || "0 9 * * *"
  }
}

/**
 * Parses a five-field UNIX cron expression into {@link CronSimpleState} where the pattern matches
 * known templates — otherwise `{ kind: "custom", expression }`.
 */
export function simpleStateFromCronExpression({ expression }: { expression: string }): CronSimpleState {
  const parts = splitCronFields({ expression })
  const raw = expression.trim() || ""

  if (!parts) {
    return { kind: "custom", expression: raw }
  }

  const [minute, hour, dom, month, dow] = parts

  if (minute === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return { kind: "every_minute" }
  }

  if (
    minute.startsWith("*/") &&
    hour === "*" &&
    dom === "*" &&
    month === "*" &&
    dow === "*"
  ) {
    const n = Number(minute.slice(2))
    if (N_MINUTES.has(n as 5 | 10 | 15 | 30)) {
      return { kind: "every_n_minutes", n: n as 5 | 10 | 15 | 30 }
    }
  }

  const mNum = Number(minute)
  const isMinuteLiteral = /^(\d\d?)$/.test(minute) && Number.isInteger(mNum) && mNum >= 0 && mNum <= 59

  if (hour === "*" && dom === "*" && month === "*" && dow === "*" && isMinuteLiteral) {
    return { kind: "hourly", minute: mNum }
  }

  const hNum = Number(hour)
  const isHourLiteral = /^(\d\d?)$/.test(hour) && Number.isInteger(hNum) && hNum >= 0 && hNum <= 23

  if (dom === "*" && month === "*" && dow === "*" && isMinuteLiteral && isHourLiteral) {
    return { kind: "daily", hour: hNum, minute: mNum }
  }

  if (dom === "*" && month === "*" && dow === "1-5" && isMinuteLiteral && isHourLiteral) {
    return { kind: "weekdays", hour: hNum, minute: mNum }
  }

  const isDomNumeric = /^(\d\d?)$/.test(dom) && Number(dom) >= 1 && Number(dom) <= 31
  if (month === "*" && dow === "*" && isMinuteLiteral && isHourLiteral && isDomNumeric) {
    const d = Number(dom)
    return { kind: "monthly", hour: hNum, minute: mNum, dayOfMonth: d }
  }

  if (
    dom === "*" &&
    month === "*" &&
    dow !== "*" &&
    isMinuteLiteral &&
    isHourLiteral
  ) {
    const segments = dow.split(",").map((x) => x.trim())
    let valid = segments.length > 0
    const days: number[] = []
    for (const seg of segments) {
      if (!/^([0-6])$/.test(seg)) {
        valid = false
        break
      }
      days.push(Number(seg))
    }
    if (valid) {
      return { kind: "weekly", hour: hNum, minute: mNum, daysCron: days }
    }
  }

  return { kind: "custom", expression: raw.length > 0 ? raw : "0 9 * * *" }
}

/**
 * Readable summary for tooling (English, product UI prefers copy from the React layer where needed).
 */
export function describeCronSimpleState({ state }: { state: CronSimpleState }): string {
  switch (state.kind) {
    case "every_minute":
      return "Runs every minute."
    case "every_n_minutes":
      return `Runs every ${state.n} minutes.`
    case "hourly":
      return state.minute === 0
        ? "Runs at the start of every hour."
        : `Runs at minute ${state.minute} past every hour.`
    case "daily":
      return `Runs once a day at ${formatClockLabel({ hour: state.hour, minute: state.minute })} (in your chosen timezone).`
    case "weekdays":
      return `Runs Monday to Friday at ${formatClockLabel({ hour: state.hour, minute: state.minute })} (in your chosen timezone).`
    case "weekly": {
      const names = [...new Set(state.daysCron)].sort((a, b) => a - b).map((cronD) => {
        const slot = WEEKDAY_COLUMNS.find((c) => c.cron === cronD)
        return slot ? slot.label : String(cronD)
      })
      return `Runs every week on ${names.join(", ")} at ${formatClockLabel({
        hour: state.hour,
        minute: state.minute,
      })} (in your chosen timezone).`
    }
    case "monthly":
      return `Runs monthly on day ${state.dayOfMonth} at ${formatClockLabel({
        hour: state.hour,
        minute: state.minute,
      })} (in your chosen timezone).`
    default:
      return "Custom cron schedule — check the preview below."
  }
}

function pad2(n: number): string {
  return String(Math.max(0, Math.min(99, Math.trunc(n)))).padStart(2, "0")
}

function formatClockLabel({ hour, minute }: { hour: number; minute: number }): string {
  return `${pad2(hour)}:${pad2(minute)}`
}

/** Checkbox column order: Monday-first (common AU / ISO office mental model); values are cron weekdays. */
export const WEEKDAY_COLUMNS: readonly { cron: number; label: string; shortLabel: string }[] = [
  { cron: 1, label: "Monday", shortLabel: "Mo" },
  { cron: 2, label: "Tuesday", shortLabel: "Tu" },
  { cron: 3, label: "Wednesday", shortLabel: "We" },
  { cron: 4, label: "Thursday", shortLabel: "Th" },
  { cron: 5, label: "Friday", shortLabel: "Fr" },
  { cron: 6, label: "Saturday", shortLabel: "Sa" },
  { cron: 0, label: "Sunday", shortLabel: "Su" },
]

/** Frequently chosen IANA zones for dropdowns — full custom entry still supported. */
export const CRON_COMMON_TIMEZONE_OPTIONS = [
  "UTC",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const
