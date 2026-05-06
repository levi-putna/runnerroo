"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import type { GatewayUsageCategoryFilter } from "@/lib/ai-gateway/gateway-usage-category";
import {
  GATEWAY_USAGE_TAG_MEMORY_QUERY,
  GATEWAY_USAGE_TAG_MEMORY_WRITE,
  GATEWAY_USAGE_TAG_PREFIX_CONVERSATION,
  GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN,
} from "@/lib/ai-gateway/runner-gateway-tracking";
import { cn } from "@/lib/utils";
import {
  endOfMonth,
  format,
  parse as parseIsoDate,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  BoxIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GitBranchIcon,
  MessageSquareIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Normalises two calendar dates to inclusive `YYYY-MM-DD` strings with the earlier day as start.
 *
 * @param startDay - One end of the span.
 * @param endDay - The other end of the span.
 */
function normaliseRangeToIsoStrings({
  startDay,
  endDay,
}: {
  startDay: Date;
  endDay: Date;
}): { startStr: string; endStr: string } {
  const left = startOfDay(startDay);
  const right = startOfDay(endDay);
  if (left <= right) {
    return {
      startStr: format(left, "yyyy-MM-dd"),
      endStr: format(right, "yyyy-MM-dd"),
    };
  }
  return {
    startStr: format(right, "yyyy-MM-dd"),
    endStr: format(left, "yyyy-MM-dd"),
  };
}

type SpendReportRow = {
  user?: string;
  tag?: string;
  provider?: string;
  totalCost: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  requestCount?: number;
};

type SpendReportPagedResponse = {
  results: SpendReportRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  filteredTotalCostUsd: number;
  filteredTotalInputTokens: number;
  filteredTotalOutputTokens: number;
  filteredTotalReasoningTokens: number;
  filteredTotalRequests: number;
  category: GatewayUsageCategoryFilter;
  providerOptions: string[];
  activeProviderFilter: string | null;
};

/** Shared styling for compact filter triggers in the toolbar (Vercel-style pill controls). */
const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Row count for the usage table skeleton while awaiting the first rows (or empty) response. */
const USAGE_TABLE_SKELETON_ROW_COUNT = 8;

/**
 * Shimmer placeholders for Gateway usage rows (matches seven-column layout).
 *
 * @param rowCount - Number of faux rows rendered (overall skeleton height).
 */
function GatewayUsageTableSkeletonRows({ rowCount }: { rowCount: number }) {
  const keys = Array.from({ length: rowCount }, (_, index) => `usage-skel-${index}`);

  return (
    <>
      {keys.map((rowKey) => (
        <tr key={rowKey} className="border-b border-border/80 last:border-0">
          {/* Type */}
          <td className="px-4 py-3">
            <div className="flex max-w-[14rem] items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded-sm" aria-hidden />
              <Skeleton className="h-5 w-24 shrink-0" />
            </div>
          </td>
          {/* Source */}
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-40 max-w-[16rem]" />
          </td>
          {/* Numeric columns */}
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-5 w-20" />
          </td>
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-5 w-14" />
          </td>
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-5 w-14" />
          </td>
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-5 w-14" />
          </td>
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-5 w-10" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Extracts a conversation id from a spend-report tag, if present.
 */
function conversationIdFromTag({ tag }: { tag: string | undefined }): string | null {
  if (tag === undefined || tag.length === 0) {
    return null;
  }
  const prefix = GATEWAY_USAGE_TAG_PREFIX_CONVERSATION;
  if (tag.toLowerCase().startsWith(prefix)) {
    const id = tag.slice(prefix.length).trim();
    return id.length > 0 ? id : null;
  }
  return null;
}

/**
 * Extracts a workflow run id from a spend-report tag, if present.
 */
function workflowRunIdFromTag({ tag }: { tag: string | undefined }): string | null {
  if (tag === undefined || tag.length === 0) {
    return null;
  }
  const prefix = GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN;
  if (tag.toLowerCase().startsWith(prefix)) {
    const id = tag.slice(prefix.length).trim();
    return id.length > 0 ? id : null;
  }
  return null;
}

/**
 * Labels the technical tag for the reference column (id suffix, memory keys, etc.).
 */
function formatUsageTagLabel({ tag }: { tag: string | undefined }): string {
  if (tag === undefined || tag.length === 0) {
    return "—";
  }
  const convPrefix = GATEWAY_USAGE_TAG_PREFIX_CONVERSATION;
  if (tag.toLowerCase().startsWith(convPrefix)) {
    return tag.slice(convPrefix.length);
  }
  const wfPrefix = GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN;
  if (tag.toLowerCase().startsWith(wfPrefix)) {
    return tag.slice(wfPrefix.length);
  }
  return tag;
}

/**
 * Buckets a spend-report tag into assistant, workflow, or other usage for display.
 */
function usageKindFromTag({ tag }: { tag: string | undefined }): "assistant" | "workflow" | "other" {
  const t = (tag ?? "").trim();
  const lower = t.toLowerCase();
  if (lower.startsWith(GATEWAY_USAGE_TAG_PREFIX_CONVERSATION.toLowerCase())) {
    return "assistant";
  }
  if (lower.startsWith(GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN.toLowerCase())) {
    return "workflow";
  }
  return "other";
}

/**
 * Short display name for the usage type column.
 */
function usageTypeShortLabelFromTag({ tag }: { tag: string | undefined }): string {
  const t = (tag ?? "").trim();
  const lower = t.toLowerCase();
  if (lower.startsWith(GATEWAY_USAGE_TAG_PREFIX_CONVERSATION.toLowerCase())) {
    return "Assistant";
  }
  if (lower.startsWith(GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN.toLowerCase())) {
    return "Workflow";
  }
  if (lower === GATEWAY_USAGE_TAG_MEMORY_WRITE.toLowerCase()) {
    return "Memory write";
  }
  if (lower === GATEWAY_USAGE_TAG_MEMORY_QUERY.toLowerCase()) {
    return "Memory search";
  }
  return "Other";
}

const CATEGORY_OPTIONS: {
  value: GatewayUsageCategoryFilter;
  menuLabel: string;
  triggerLabel: string;
}[] = [
  { value: "all", menuLabel: "All types", triggerLabel: "All types" },
  { value: "assistant", menuLabel: "Assistant", triggerLabel: "Assistant" },
  { value: "workflow", menuLabel: "Workflows", triggerLabel: "Workflows" },
  { value: "other", menuLabel: "Other", triggerLabel: "Other" },
];

/**
 * Returns the short label shown on the type filter trigger for the current category.
 */
function categoryTriggerLabel({ category }: { category: GatewayUsageCategoryFilter }): string {
  return CATEGORY_OPTIONS.find((o) => o.value === category)?.triggerLabel ?? "All types";
}

type GatewayUsagePanelProps = {
  /** Extra classes on the outer wrapper (scroll regions, spacing). */
  className?: string;
};

/**
 * AI Gateway usage for the signed-in user: assistant conversations, workflow runs, and other tagged traffic.
 */
export function GatewayUsagePanel({ className }: GatewayUsagePanelProps) {
  const today = useMemo(() => new Date(), []);

  const initialRange = useMemo(
    () => ({
      start: startOfDay(startOfMonth(today)),
      end: endOfMonth(today),
    }),
    [today],
  );

  const [appliedStartDate, setAppliedStartDate] = useState(() =>
    format(initialRange.start, "yyyy-MM-dd"),
  );
  const [appliedEndDate, setAppliedEndDate] = useState(() =>
    format(initialRange.end, "yyyy-MM-dd"),
  );

  const [category, setCategory] = useState<GatewayUsageCategoryFilter>("all");
  const [providerFilter, setProviderFilter] = useState("");
  const [page, setPage] = useState(1);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);

  /** Visible month for the range calendar (dropdown captions jump years without fighting `defaultMonth`). */
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  /** Keeps the latest range day-clicks in sync for commit-on-dismiss (avoids stale state if the popover closes in the same event turn as the last click). */
  const dateRangeDraftRef = useRef<DateRange | undefined>(undefined);
  const [dateRangeDraft, setDateRangeDraft] = useState<DateRange | undefined>(undefined);

  const [data, setData] = useState<SpendReportPagedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const calendarRange = useMemo((): DateRange | undefined => {
    const from = parseIsoDate(appliedStartDate, "yyyy-MM-dd", new Date());
    const to = parseIsoDate(appliedEndDate, "yyyy-MM-dd", new Date());
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return undefined;
    }
    return { from, to };
  }, [appliedStartDate, appliedEndDate]);

  /* When the picker opens, anchor the calendar on the applied range start so future months are reachable in one flow. */
  useEffect(() => {
    if (!datePickerOpen) {
      return;
    }
    const anchor = parseIsoDate(appliedStartDate, "yyyy-MM-dd", new Date());
    if (!Number.isNaN(anchor.getTime())) {
      setCalendarMonth(anchor);
    }
  }, [datePickerOpen, appliedStartDate]);

  const dateToolbarLabel = useMemo(() => {
    if (!calendarRange?.from || !calendarRange.to) {
      return "Select date range";
    }
    return `${format(calendarRange.from, "d MMM yyyy")} – ${format(calendarRange.to, "d MMM yyyy")}`;
  }, [calendarRange]);

  /* Loads Gateway spend when date range, category, provider, or page changes. */
  useEffect(() => {
    let cancelled = false;

    async function loadSpendReport(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          startDate: appliedStartDate,
          endDate: appliedEndDate,
          page: String(page),
          category,
        });
        if (providerFilter.length > 0) {
          params.set("provider", providerFilter);
        }

        const response = await fetch(`/api/usage/gateway?${params.toString()}`);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setData(null);
          setError(payload?.error ?? `Request failed (${response.status})`);
          return;
        }

        const json = (await response.json()) as SpendReportPagedResponse;
        setData(json);
        setPage(json.page);
      } catch {
        if (!cancelled) {
          setData(null);
          setError("Could not load usage data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSpendReport();

    return () => {
      cancelled = true;
    };
  }, [appliedStartDate, appliedEndDate, category, page, providerFilter]);

  /**
   * US dollar amounts for Gateway spend. Uses en-AU so USD is shown as US$ (not confused with AUD)
   * and allows up to six fraction digits for sub-cent totals.
   */
  const usd = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "USD",
        currencyDisplay: "symbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }),
    [],
  );

  const formatTokens = useCallback(({ value }: { value?: number }) => {
    if (value === undefined || Number.isNaN(value)) return "—";
    return new Intl.NumberFormat("en-AU").format(value);
  }, []);

  const totalCount = data?.totalCount ?? 0;
  const effectivePage = data?.page ?? page;
  const effectivePageSize = data?.pageSize ?? 50;

  const rangeLabel = useMemo(() => {
    if (totalCount === 0) return "No rows";
    const startIdx = (effectivePage - 1) * effectivePageSize + 1;
    const endIdx = Math.min(effectivePage * effectivePageSize, totalCount);
    return `${startIdx}–${endIdx} of ${totalCount}`;
  }, [effectivePage, effectivePageSize, totalCount]);

  const maxPage = Math.max(1, Math.ceil(totalCount / effectivePageSize) || 1);

  const filteredTotalCostUsd = data?.filteredTotalCostUsd ?? 0;
  const filteredTotalInputTokens = data?.filteredTotalInputTokens ?? 0;
  const filteredTotalOutputTokens = data?.filteredTotalOutputTokens ?? 0;
  const filteredTotalReasoningTokens = data?.filteredTotalReasoningTokens ?? 0;
  const filteredTotalRequests = data?.filteredTotalRequests ?? 0;

  const typeScopeBadge = category === "all" ? "3/3" : "1/3";

  const providerOptions = data?.providerOptions ?? [];
  const showProviderFilter = providerOptions.length > 0 || providerFilter.length > 0;

  const providerTriggerLabel =
    providerFilter.length === 0 ? "All providers…" : providerFilter;

  /**
   * Persists a span to filter state and keeps the draft range aligned (used by presets and full range picks).
   */
  const syncDraftAndCommitRange = useCallback(({ from, to }: { from: Date; to: Date }) => {
    const { startStr, endStr } = normaliseRangeToIsoStrings({ startDay: from, endDay: to });
    const nextFrom = parseIsoDate(startStr, "yyyy-MM-dd", new Date());
    const nextTo = parseIsoDate(endStr, "yyyy-MM-dd", new Date());
    const nextRange: DateRange = { from: nextFrom, to: nextTo };
    dateRangeDraftRef.current = nextRange;
    setDateRangeDraft(nextRange);
    setAppliedStartDate(startStr);
    setAppliedEndDate(endStr);
    setPage(1);
  }, []);

  const applyPresetThisMonth = useCallback(() => {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    syncDraftAndCommitRange({ from, to });
    setDatePickerOpen(false);
  }, [today, syncDraftAndCommitRange]);

  const applyPresetLast30Days = useCallback(() => {
    const from = startOfDay(subDays(today, 29));
    const to = startOfDay(today);
    syncDraftAndCommitRange({ from, to });
    setDatePickerOpen(false);
  }, [today, syncDraftAndCommitRange]);

  const applyPresetLastCalendarMonth = useCallback(() => {
    const centre = subMonths(today, 1);
    const from = startOfMonth(centre);
    const to = endOfMonth(centre);
    syncDraftAndCommitRange({ from, to });
    setDatePickerOpen(false);
  }, [today, syncDraftAndCommitRange]);

  /**
   * Range edits stay in draft while the popover is open. If only the start day is chosen, closing applies
   * the previous end when it is still on/after the new start; otherwise the range collapses to a single day
   * until a new end is chosen. Choosing both dates applies immediately and closes.
   */
  const handleDatePopoverOpenChange = useCallback(
    ({ open }: { open: boolean }) => {
      if (open) {
        dateRangeDraftRef.current = calendarRange;
        setDateRangeDraft(calendarRange);
        setDatePickerOpen(true);
        return;
      }

      setDatePickerOpen(false);

      const next = dateRangeDraftRef.current;
      if (next?.from === undefined) {
        return;
      }

      let endDate = next.to;

      if (endDate === undefined) {
        const previousEnd = parseIsoDate(appliedEndDate, "yyyy-MM-dd", new Date());
        const startOnly = startOfDay(next.from);
        if (!Number.isNaN(previousEnd.getTime()) && startOnly <= startOfDay(previousEnd)) {
          endDate = previousEnd;
        } else {
          endDate = startOnly;
        }
      }

      const { startStr, endStr } = normaliseRangeToIsoStrings({
        startDay: next.from,
        endDay: endDate,
      });

      if (startStr === appliedStartDate && endStr === appliedEndDate) {
        return;
      }

      syncDraftAndCommitRange({
        from: parseIsoDate(startStr, "yyyy-MM-dd", new Date()),
        to: parseIsoDate(endStr, "yyyy-MM-dd", new Date()),
      });
    },
    [calendarRange, appliedStartDate, appliedEndDate, syncDraftAndCommitRange],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* ── Page title (fixed header row) ── */}
      <PageHeader
        title="Usage"
        description="AI Gateway spend attributed to your account. Assistant chats are tagged by conversation; workflow AI steps are tagged by workflow run. Memory search and writes appear under Other."
      />

      <div className="flex flex-col gap-6 p-6">
        {/* ── Filter toolbar: horizontal pill controls ── */}
        <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto pb-0.5">
          <Popover open={datePickerOpen} onOpenChange={(open) => handleDatePopoverOpenChange({ open })}>
            <PopoverTrigger asChild>
              <button type="button" className={cn(FILTER_TRIGGER_CLASS, "max-w-[min(100%,20rem)]")}>
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{dateToolbarLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              {/* Presets + hint: two-click range is standard; dropdown months speed up far-future ranges. */}
              <div className="flex flex-col gap-2 border-b border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Choose a start date, then an end date. Presets apply straight away; you can also jump
                  month and year from the dropdowns.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={applyPresetThisMonth}>
                    This month
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={applyPresetLast30Days}>
                    Last 30 days
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={applyPresetLastCalendarMonth}
                  >
                    Last month
                  </Button>
                </div>
              </div>

              <Calendar
                mode="range"
                resetOnSelect
                required={false}
                captionLayout="dropdown"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                numberOfMonths={2}
                selected={datePickerOpen ? dateRangeDraft : calendarRange}
                onSelect={(range) => {
                  dateRangeDraftRef.current = range;
                  setDateRangeDraft(range);
                  if (range?.from !== undefined && range.to !== undefined) {
                    syncDraftAndCommitRange({ from: range.from, to: range.to });
                    setDatePickerOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Popover open={typePickerOpen} onOpenChange={setTypePickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={FILTER_TRIGGER_CLASS}>
                <span className="flex items-center gap-0.5" aria-hidden>
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="size-1.5 rounded-full bg-sky-500" />
                  <span className="size-1.5 rounded-full bg-amber-500" />
                </span>
                <span className="text-muted-foreground">Type</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {typeScopeBadge}
                </span>
                <span className="max-w-[10rem] truncate font-medium text-foreground">
                  {categoryTriggerLabel({ category })}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[16rem] p-0">
              <Command>
                <CommandInput placeholder="Search types…" />
                <CommandList>
                  <CommandEmpty>No type found.</CommandEmpty>
                  <CommandGroup>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        keywords={[opt.menuLabel, opt.triggerLabel]}
                        onSelect={() => {
                          setCategory(opt.value);
                          setProviderFilter("");
                          setPage(1);
                          setTypePickerOpen(false);
                        }}
                      >
                        {opt.menuLabel}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {showProviderFilter ? (
            <Popover open={providerPickerOpen} onOpenChange={setProviderPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={cn(FILTER_TRIGGER_CLASS, "max-w-[min(100%,14rem)]")}>
                  <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      providerFilter.length === 0 ? "text-muted-foreground" : "font-medium text-foreground",
                    )}
                  >
                    {providerTriggerLabel}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[18rem] p-0">
                <Command>
                  <CommandInput placeholder="Search providers…" />
                  <CommandList>
                    <CommandEmpty>No provider found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__"
                        keywords={["all", "providers"]}
                        onSelect={() => {
                          setProviderFilter("");
                          setPage(1);
                          setProviderPickerOpen(false);
                        }}
                      >
                        All providers
                      </CommandItem>
                      {providerOptions.map((p) => (
                        <CommandItem
                          key={p}
                          value={p}
                          keywords={[p]}
                          onSelect={() => {
                            setProviderFilter(p);
                            setPage(1);
                            setProviderPickerOpen(false);
                          }}
                        >
                          {p}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        {/* ── Summary totals ── */}
        <div className="flex flex-col gap-4" aria-busy={loading}>
          <p className="text-sm font-medium text-foreground">Total usage (filtered)</p>
          <p className="text-xs text-muted-foreground">
            All costs are in US dollars; values use the currency prefix (including small fractions of a
            cent where applicable).
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total cost
              </p>
              {loading ? (
                <Skeleton className="mt-1 h-7 w-[8.5rem] max-w-full" />
              ) : (
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {usd.format(filteredTotalCostUsd)}
                </p>
              )}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Input tokens
              </p>
              {loading ? (
                <Skeleton className="mt-1 h-7 w-24 max-w-full" />
              ) : (
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalInputTokens })}
                </p>
              )}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Output tokens
              </p>
              {loading ? (
                <Skeleton className="mt-1 h-7 w-24 max-w-full" />
              ) : (
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalOutputTokens })}
                </p>
              )}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reasoning tokens
              </p>
              {loading ? (
                <Skeleton className="mt-1 h-7 w-24 max-w-full" />
              ) : (
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalReasoningTokens })}
                </p>
              )}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Requests
              </p>
              {loading ? (
                <Skeleton className="mt-1 h-7 w-20 max-w-full" />
              ) : (
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalRequests })}
                </p>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* ── Table ── */}
        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <table
            className="w-full min-w-[52rem] border-collapse text-sm"
            aria-busy={loading && (!data || data.results.length === 0)}
          >
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Total cost</th>
                <th className="px-4 py-3 text-right">Input tokens</th>
                <th className="px-4 py-3 text-right">Output tokens</th>
                <th className="px-4 py-3 text-right">Reasoning tokens</th>
                <th className="px-4 py-3 text-right">Requests</th>
              </tr>
            </thead>
            <tbody>
              {loading && (!data || data.results.length === 0) ? (
                <GatewayUsageTableSkeletonRows rowCount={USAGE_TABLE_SKELETON_ROW_COUNT} />
              ) : !data || data.results.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No usage for this date range.
                  </td>
                </tr>
              ) : (
                data.results.map((row, index) => {
                  const convId = conversationIdFromTag({ tag: row.tag });
                  const runId = workflowRunIdFromTag({ tag: row.tag });
                  const kind = usageKindFromTag({ tag: row.tag });
                  const typeLabel = usageTypeShortLabelFromTag({ tag: row.tag });
                  const sourceLabel = formatUsageTagLabel({ tag: row.tag });

                  const TypeIcon =
                    kind === "assistant"
                      ? MessageSquareIcon
                      : kind === "workflow"
                        ? GitBranchIcon
                        : BoxIcon;

                  return (
                    <tr
                      key={`${effectivePage}-${index}-${row.tag ?? index}`}
                      className="border-b border-border/80 last:border-0"
                    >
                      {/* Type: icon + label; assistant rows link to the chat */}
                      <td className="px-4 py-3">
                        {convId ? (
                          <Link
                            href={`/app/chat/${encodeURIComponent(convId)}`}
                            className="flex min-w-0 max-w-[14rem] items-center gap-2 text-primary underline-offset-4 hover:underline"
                          >
                            <TypeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="truncate font-medium">{typeLabel}</span>
                          </Link>
                        ) : (
                          <div className="flex min-w-0 max-w-[14rem] items-center gap-2">
                            <TypeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="truncate font-medium text-foreground">{typeLabel}</span>
                          </div>
                        )}
                      </td>
                      {/* Source: deep links for assistant + workflow */}
                      <td
                        className="max-w-[16rem] truncate px-4 py-3 font-mono text-xs"
                        title={row.tag ?? ""}
                      >
                        {convId ? (
                          <Link
                            href={`/app/chat/${encodeURIComponent(convId)}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {sourceLabel}
                          </Link>
                        ) : runId ? (
                          <Link
                            href={`/app/run/${encodeURIComponent(runId)}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {sourceLabel}
                          </Link>
                        ) : (
                          sourceLabel
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{usd.format(row.totalCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatTokens({ value: row.inputTokens })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatTokens({ value: row.outputTokens })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatTokens({ value: row.reasoningTokens })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatTokens({ value: row.requestCount })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={effectivePage <= 1 || loading}
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
              Previous
            </Button>
            <span className="tabular-nums text-sm text-muted-foreground">
              Page {effectivePage} / {maxPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={effectivePage >= maxPage || loading}
              onClick={() => setPage((previous) => Math.min(maxPage, previous + 1))}
            >
              Next
              <ChevronRightIcon className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
