"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { CalendarClock, Globe, History } from "lucide-react"
import { CronExpressionParser } from "cron-parser"
import { formatDistanceToNowStrict } from "date-fns/formatDistanceToNowStrict"
import { enAU } from "date-fns/locale/en-AU"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  CRON_COMMON_TIMEZONE_OPTIONS,
  WEEKDAY_COLUMNS,
  cronExpressionFromSimpleState,
  type CronSimpleState,
  simpleStateFromCronExpression,
} from "@/lib/workflows/cron-expression-builder-logic"

/** Sentinel internal to timezone shortcut select — no predefined row matches typed IANA. */
const CRON_SHORTCUT_SENTINEL = "__cron_tz_shortcuts_none__"

/** Non-custom schedule state surfaced in the picker (ambiguous cron strings degrade to defaults). */
type PresetCronState = Exclude<CronSimpleState, { kind: "custom" }>

type FrequencyOption =
  | "every_minute"
  | "every_5"
  | "every_10"
  | "every_15"
  | "every_30"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"

/** Order + human copy for recurrence — underlying `value` stays the FrequencyOption slug for state/cron encode. */
const FREQUENCY_ITEMS: readonly { value: FrequencyOption; label: string }[] = [
  { value: "every_minute", label: "Every minute" },
  { value: "every_5", label: "Every 5 minutes" },
  { value: "every_10", label: "Every 10 minutes" },
  { value: "every_15", label: "Every 15 minutes" },
  { value: "every_30", label: "Every 30 minutes" },
  { value: "hourly", label: "Hourly minute offset" },
  { value: "daily", label: "Daily at a chosen time" },
  { value: "weekdays", label: "Weekdays Monday to Friday" },
  { value: "weekly", label: "Weekly on selected weekdays" },
  { value: "monthly", label: "Monthly on a calendar date" },
]

const FREQUENCY_LABEL_BY_SLUG = Object.fromEntries(FREQUENCY_ITEMS.map(({ value, label }) => [value, label])) as Record<
  FrequencyOption,
  string
>

/**
 * Minute offset copy for hourly cadence (`At :MM each hour`), reused by list rows and trigger while the dropdown is closed.
 */
function formatHourlyMinuteMarkerLabel({ minute }: { minute: number }): string {
  return `At :${String(minute).padStart(2, "0")} each hour`
}

/** Wall-clock hour trigger + option label (aligned to two-digit HH:00). */
function formatWallClockHourLabel({ hour }: { hour: number }): string {
  return `${String(hour).padStart(2, "0")}:00`
}

/** Wall-clock minute column digits (00–59). */
function formatWallClockMinuteLabel({ minute }: { minute: number }): string {
  return String(minute).padStart(2, "0")
}

/** Monthly “Day N” list + trigger label. */
function formatCalendarDayLabel({ day }: { day: number }): string {
  return `Day ${day}`
}

const QUICK_TZ_SENTINEL_ITEM_LABEL = "Custom value only below"

/** Resolved label for the quick-region shortcut control (sentinel ≠ IANA slug). */
function quickTzShortcutTriggerLabel(params: {
  shortcutSelection: string
  /** Effective zone string stored on the workflow (may equal a shortcut zone or a custom string). */
  storedTimezone: string
}): string {
  const { shortcutSelection, storedTimezone } = params
  if (shortcutSelection === CRON_SHORTCUT_SENTINEL) {
    return QUICK_TZ_SENTINEL_ITEM_LABEL
  }
  return storedTimezone
}

/** Header + bordered body patterned after {@link InputSchemaBuilder}. */
function WorkflowPanelShell({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40",
      )}
    >
      {/* Branding strip — aligns with workflow schema builders */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background"
          aria-hidden
        >
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">{title}</p>
          <div className="text-xs text-muted-foreground leading-relaxed">{subtitle}</div>
        </div>
      </div>

      <div className="space-y-0 px-4 pb-4 pt-4">{children}</div>
    </div>
  )
}

interface CronExpressionBuilderProps {
  cronExpression: string
  timezone: string
  onCronExpressionChange: ({ expression }: { expression: string }) => void
}

interface CronTimezoneFieldProps {
  timezone: string
  /** Called when timezone field updates (combined list + arbitrary string). */
  onTimezoneChange: ({ timezone }: { timezone: string }) => void
}

/** Maps stored cron strings to preset picker state — custom patterns snap to weekday-morning UTC before persisting back. */
function presetStateFromCronExpression({ expression }: { expression: string }): PresetCronState {
  const raw = simpleStateFromCronExpression({ expression })
  if (raw.kind === "custom") {
    return { kind: "daily", hour: 9, minute: 0 }
  }
  return raw
}

/**
 * Guided recurrence picker with a timezone-aware run preview — surfaced inside the Schedule trigger tab only.
 *
 * Expressions that do not align with presets are rewritten to a sane default on open (no Advanced editor retained).
 */
export function CronExpressionBuilder({
  cronExpression,
  timezone,
  onCronExpressionChange,
}: CronExpressionBuilderProps) {
  const tz = timezone.trim() !== "" ? timezone.trim() : "UTC"

  /** Avoid lint noise from unstable parent lambdas — only the latest updater runs. */
  const onCronRef = React.useRef(onCronExpressionChange)
  React.useLayoutEffect(() => {
    onCronRef.current = onCronExpressionChange
  })

  /** Persist coercion so graph JSON never hangs on undocumented cron literals. */
  React.useLayoutEffect(() => {
    const raw = simpleStateFromCronExpression({ expression: cronExpression })
    if (raw.kind !== "custom") return
    queueMicrotask(() =>
      onCronRef.current({
        expression: cronExpressionFromSimpleState({ state: { kind: "daily", hour: 9, minute: 0 } }),
      }),
    )
  }, [cronExpression])

  /** Always preset-shaped for UI widgets. */
  const derivedPresetState = React.useMemo(
    (): PresetCronState => presetStateFromCronExpression({ expression: cronExpression }),
    [cronExpression],
  )

  const canonicalExpressionForPreview = React.useMemo(() => {
    return cronExpressionFromSimpleState({ state: derivedPresetState })
  }, [derivedPresetState])

  const previewTimeline = React.useMemo(() => {
    const expr = canonicalExpressionForPreview.trim()
    if (expr === "") return []

    try {
      const iv = CronExpressionParser.parse(expr, { currentDate: new Date(), tz })
      /** `take` lists the sequential fire anchors without rewinding iterators by hand. */
      const cds = iv.take(5).map((d) => {
        const iso = d.toDate()
        const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "long", timeZone: tz }).format(iso)
        const stamp = new Intl.DateTimeFormat("en-AU", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        }).format(iso)

        const horizonLabel = formatDistanceToNowStrict(iso, {
          locale: enAU,
          roundingMethod: "floor",
          addSuffix: true,
        })

        return {
          weekday,
          stamp,
          horizonLabel,
          atMillis: iso.getTime(),
        }
      })

      return cds.map((row, idx) => ({
        id: `${row.atMillis}-${idx}`,
        weekday: row.weekday,
        stamp: row.stamp,
        horizonLabel: row.horizonLabel,
        stepLabel: idx === 0 ? "Next run" : `Run ${idx + 1}`,
      }))
    } catch {
      return []
    }
  }, [canonicalExpressionForPreview, tz])

  const frequencyFromState = React.useMemo((): FrequencyOption => {
    switch (derivedPresetState.kind) {
      case "every_minute":
        return "every_minute"
      case "every_n_minutes":
        if (derivedPresetState.n === 5) return "every_5"
        if (derivedPresetState.n === 10) return "every_10"
        if (derivedPresetState.n === 15) return "every_15"
        if (derivedPresetState.n === 30) return "every_30"
        return "every_5"
      case "hourly":
        return "hourly"
      case "daily":
        return "daily"
      case "weekdays":
        return "weekdays"
      case "weekly":
        return "weekly"
      case "monthly":
        return "monthly"
      default:
        return "daily"
    }
  }, [derivedPresetState])

  function resolveClockFromState(params: {
    fallbackHour: number
    fallbackMinute: number
  }): { hour: number; minute: number } {
    const { fallbackHour, fallbackMinute } = params
    if (
      derivedPresetState.kind === "daily" ||
      derivedPresetState.kind === "weekdays" ||
      derivedPresetState.kind === "weekly" ||
      derivedPresetState.kind === "monthly"
    ) {
      return { hour: derivedPresetState.hour, minute: derivedPresetState.minute }
    }
    if (derivedPresetState.kind === "hourly") {
      return { hour: fallbackHour, minute: derivedPresetState.minute }
    }
    return { hour: fallbackHour, minute: fallbackMinute }
  }

  function persistPreset(next: PresetCronState) {
    onCronRef.current({
      expression: cronExpressionFromSimpleState({ state: next }),
    })
  }

  function defaultHmForNextFrequency(freq: FrequencyOption): { hour: number; minute: number } {
    const base = resolveClockFromState({ fallbackHour: 9, fallbackMinute: 0 })
    if (freq === "hourly") {
      return {
        hour: base.hour,
        minute: derivedPresetState.kind === "hourly" ? derivedPresetState.minute : base.minute,
      }
    }
    return base
  }

  /** Maps recurrence dropdown rows into concrete Cron payload shapes. */
  function handleFrequencyPick(nextFreq: FrequencyOption) {
    const hm = defaultHmForNextFrequency(nextFreq)

    switch (nextFreq) {
      case "every_minute":
        persistPreset({ kind: "every_minute" })
        return
      case "every_5":
        persistPreset({ kind: "every_n_minutes", n: 5 })
        return
      case "every_10":
        persistPreset({ kind: "every_n_minutes", n: 10 })
        return
      case "every_15":
        persistPreset({ kind: "every_n_minutes", n: 15 })
        return
      case "every_30":
        persistPreset({ kind: "every_n_minutes", n: 30 })
        return
      case "hourly":
        persistPreset({
          kind: "hourly",
          minute: derivedPresetState.kind === "hourly" ? derivedPresetState.minute : hm.minute,
        })
        return
      case "daily":
        persistPreset({ kind: "daily", hour: hm.hour, minute: hm.minute })
        return
      case "weekdays":
        persistPreset({ kind: "weekdays", hour: hm.hour, minute: hm.minute })
        return
      case "weekly":
        if (derivedPresetState.kind === "weekly") {
          persistPreset({
            kind: "weekly",
            hour: hm.hour,
            minute: hm.minute,
            daysCron: derivedPresetState.daysCron,
          })
        } else {
          persistPreset({ kind: "weekly", hour: hm.hour, minute: hm.minute, daysCron: [1] })
        }
        return
      case "monthly":
        if (derivedPresetState.kind === "monthly") {
          persistPreset({
            kind: "monthly",
            hour: hm.hour,
            minute: hm.minute,
            dayOfMonth: derivedPresetState.dayOfMonth,
          })
        } else {
          persistPreset({ kind: "monthly", hour: hm.hour, minute: hm.minute, dayOfMonth: 1 })
        }
        return
      default:
        return
    }
  }

  const hourOptions = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minuteOptions = React.useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

  const showClockRow =
    derivedPresetState.kind === "daily" ||
    derivedPresetState.kind === "weekdays" ||
    derivedPresetState.kind === "weekly" ||
    derivedPresetState.kind === "monthly"

  const hm = resolveClockFromState({ fallbackHour: 9, fallbackMinute: 0 })

  return (
    <div className="space-y-4">
      <WorkflowPanelShell
        icon={CalendarClock}
        title="Schedule"
        subtitle="Choose recurrence and local wall-clock time. The timezone panel below defines which region those hours belong to."
      >
        {/* Recurrence field stack */}
        <div className="space-y-4">
          {/* Primary cadence */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Recurrence
            </Label>
            <Select value={frequencyFromState} onValueChange={(v) => handleFrequencyPick(v as FrequencyOption)}>
              <SelectTrigger className="w-full rounded-lg border-input/80 bg-background">
                {/* Base UI clears item text when closed; render label from slug so the trigger never shows raw values. */}
                <SelectValue placeholder="Select cadence pattern">
                  {(v) =>
                    typeof v === "string" && v !== "" ? (FREQUENCY_LABEL_BY_SLUG[v as FrequencyOption] ?? "") : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_ITEMS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {derivedPresetState.kind === "hourly" ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Minute marker
              </Label>
              <Select
                value={String(derivedPresetState.minute)}
                onValueChange={(v) => {
                  persistPreset({ kind: "hourly", minute: Number(v) })
                }}
              >
                <SelectTrigger className="rounded-lg border-input/80 bg-background">
                  <SelectValue>
                    {(v) => {
                      const mn = typeof v === "string" ? Number.parseInt(v, 10) : NaN
                      return Number.isFinite(mn) ? formatHourlyMinuteMarkerLabel({ minute: mn }) : ""
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {minuteOptions.map((mn) => (
                    <SelectItem key={mn} value={String(mn)}>
                      {formatHourlyMinuteMarkerLabel({ minute: mn })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {showClockRow ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Wall-clock hour */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Hour
                </Label>
                <Select
                  value={String(hm.hour)}
                  onValueChange={(v) => {
                    const nextH = Number(v)
                    const nextM = hm.minute
                    if (derivedPresetState.kind === "daily") {
                      persistPreset({ kind: "daily", hour: nextH, minute: nextM })
                    }
                    if (derivedPresetState.kind === "weekdays") {
                      persistPreset({ kind: "weekdays", hour: nextH, minute: nextM })
                    }
                    if (derivedPresetState.kind === "weekly") {
                      persistPreset({
                        kind: "weekly",
                        hour: nextH,
                        minute: nextM,
                        daysCron: derivedPresetState.daysCron,
                      })
                    }
                    if (derivedPresetState.kind === "monthly") {
                      persistPreset({
                        kind: "monthly",
                        hour: nextH,
                        minute: nextM,
                        dayOfMonth: derivedPresetState.dayOfMonth,
                      })
                    }
                  }}
                >
                  <SelectTrigger className="rounded-lg border-input/80 bg-background">
                    <SelectValue>
                      {(v) => {
                        const h = typeof v === "string" ? Number.parseInt(v, 10) : NaN
                        return Number.isFinite(h) ? formatWallClockHourLabel({ hour: h }) : ""
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatWallClockHourLabel({ hour: h })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Minute column */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Minute
                </Label>
                <Select
                  value={String(hm.minute)}
                  onValueChange={(v) => {
                    const nextM = Number(v)
                    const nextH = hm.hour
                    if (derivedPresetState.kind === "daily") {
                      persistPreset({ kind: "daily", hour: nextH, minute: nextM })
                    }
                    if (derivedPresetState.kind === "weekdays") {
                      persistPreset({ kind: "weekdays", hour: nextH, minute: nextM })
                    }
                    if (derivedPresetState.kind === "weekly") {
                      persistPreset({
                        kind: "weekly",
                        hour: nextH,
                        minute: nextM,
                        daysCron: derivedPresetState.daysCron,
                      })
                    }
                    if (derivedPresetState.kind === "monthly") {
                      persistPreset({
                        kind: "monthly",
                        hour: nextH,
                        minute: nextM,
                        dayOfMonth: derivedPresetState.dayOfMonth,
                      })
                    }
                  }}
                >
                  <SelectTrigger className="rounded-lg border-input/80 bg-background">
                    <SelectValue>
                      {(v) => {
                        const mn = typeof v === "string" ? Number.parseInt(v, 10) : NaN
                        return Number.isFinite(mn) ? formatWallClockMinuteLabel({ minute: mn }) : ""
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((mn) => (
                      <SelectItem key={mn} value={String(mn)}>
                        {formatWallClockMinuteLabel({ minute: mn })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {/* Weekly dow matrix */}
          {derivedPresetState.kind === "weekly" ? (
            <fieldset className="space-y-2">
              <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Weekdays selection
              </legend>
              <div className="flex flex-wrap gap-3 rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-3">
                {WEEKDAY_COLUMNS.map(({ cron, label, shortLabel }) => {
                  const on = derivedPresetState.daysCron.includes(cron)
                  return (
                    <label key={cron} className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <Checkbox
                        checked={on}
                        onCheckedChange={(c) => {
                          const checked = c === true
                          const nextSet = checked
                            ? [...derivedPresetState.daysCron, cron]
                            : derivedPresetState.daysCron.filter((d) => d !== cron)
                          persistPreset({
                            kind: "weekly",
                            hour: hm.hour,
                            minute: hm.minute,
                            daysCron: nextSet.length > 0 ? nextSet : [1],
                          })
                        }}
                        aria-label={label}
                      />
                      <span className="select-none text-foreground">{shortLabel}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          {/* Monthly ordinal */}
          {derivedPresetState.kind === "monthly" ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Calendar day
              </Label>
              <Select
                value={String(derivedPresetState.dayOfMonth)}
                onValueChange={(v) => {
                  persistPreset({
                    kind: "monthly",
                    hour: hm.hour,
                    minute: hm.minute,
                    dayOfMonth: Number(v),
                  })
                }}
              >
                <SelectTrigger className="rounded-lg border-input/80 bg-background">
                  <SelectValue>
                    {(v) => {
                      const d = typeof v === "string" ? Number.parseInt(v, 10) : NaN
                      return Number.isFinite(d) ? formatCalendarDayLabel({ day: d }) : ""
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {formatCalendarDayLabel({ day: d })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Short months silently skip occurrences per standard cron semantics.
              </p>
            </div>
          ) : null}
        </div>
      </WorkflowPanelShell>

      {/* Upcoming runs list preview */}
      <WorkflowPanelShell
        icon={History}
        title="Upcoming runs preview"
        subtitle={
          <>
            Simulated fire order in <span className="font-medium text-foreground">{tz}</span>. Supabase still needs to
            call your dispatcher every minute before this cadence can line up server-side.
          </>
        }
      >
        {/* Run forecast — stacked rows with dividers */}
        {previewTimeline.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Pick a recurrence pattern to generate the next five predicted execution windows.
          </div>
        ) : (
          <ul
            className="m-0 list-none divide-y divide-border p-0"
            role="list"
            aria-label="Predicted next runs"
          >
            {previewTimeline.map((row) => (
              <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                {/* Run row */}
                <div className="min-w-0">
                  {/* Primary line — run tag left of weekday title; horizon on the far right */}
                  <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* Step label chip — compact, slight corner radius */}
                      <span className="inline-flex max-w-[min(100%,14rem)] shrink-0 items-center rounded-sm border border-border/60 bg-muted/90 px-2 py-0.5 text-[10px] font-medium leading-snug tracking-tight text-muted-foreground">
                        {row.stepLabel}
                      </span>
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{row.weekday}</p>
                    </div>
                    <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{row.horizonLabel}</p>
                  </div>
                  {/* Exact timestamp */}
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{row.stamp}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WorkflowPanelShell>
    </div>
  )
}

/** Timezone selectors sharing the workflow schema shell motif. */
export function CronTimezoneField({ timezone, onTimezoneChange }: CronTimezoneFieldProps) {
  const val = timezone.trim() !== "" ? timezone.trim() : "UTC"
  const legal = React.useMemo(() => {
    try {
      return typeof Intl.supportedValuesOf === "function"
        ? (Intl.supportedValuesOf("timeZone") as string[])
        : []
    } catch {
      return [] as string[]
    }
  }, [])

  const hasSupport = React.useMemo(() => {
    try {
      new Intl.DateTimeFormat("en-AU", { timeZone: val })
      return true
    } catch {
      return false
    }
  }, [val])

  const shortcutValue = CRON_COMMON_TIMEZONE_OPTIONS.some((zone) => zone === val)
    ? val
    : CRON_SHORTCUT_SENTINEL

  return (
    <WorkflowPanelShell
      icon={Globe}
      title="Timezone reference"
      subtitle="Cron aligns to wall-clock minutes in this IANA zone. Fix spelling if the browser flags it as unknown."
    >
      <div className="space-y-4">
        {/* Shortcut regions */}
        <div className="space-y-1.5">
          <Label htmlFor="cron-quick-tz" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Quick regions
          </Label>
          <Select
            value={shortcutValue}
            onValueChange={(picked) => {
              if (picked === null || picked === CRON_SHORTCUT_SENTINEL) return
              onTimezoneChange({ timezone: picked })
            }}
          >
            <SelectTrigger id="cron-quick-tz" className="rounded-lg border-input/80 bg-background">
              <SelectValue placeholder="Select a hotspot region">
                {(v) =>
                  typeof v === "string" && v !== ""
                    ? quickTzShortcutTriggerLabel({
                        shortcutSelection: v,
                        storedTimezone: val,
                      })
                    : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CRON_SHORTCUT_SENTINEL}>{QUICK_TZ_SENTINEL_ITEM_LABEL}</SelectItem>
              {CRON_COMMON_TIMEZONE_OPTIONS.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manual IANA input */}
        <div className="space-y-1.5">
          <Label htmlFor="cron-iana-zone" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            IANA identifier
          </Label>
          <Input
            id="cron-iana-zone"
            className="font-mono text-sm"
            spellCheck={false}
            autoComplete="off"
            placeholder="Australia/Melbourne"
            list="cron-tz-supported"
            value={val}
            onChange={(e) => onTimezoneChange({ timezone: e.target.value })}
          />
          {legal.length > 0 ? (
            <datalist id="cron-tz-supported">
              {legal.slice(0, 200).map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          ) : null}
          {!hasSupport ? (
            <p role="alert" className="text-xs text-destructive">
              This browser does not recognise that identifier — revise spelling before saving.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Values persist on the workflow and align Supabase pings to local wall-clock buckets.
            </p>
          )}
        </div>
      </div>
    </WorkflowPanelShell>
  )
}
