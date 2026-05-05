"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GatewayUsageCategoryFilter } from "@/lib/ai-gateway/gateway-usage-category";
import {
  GATEWAY_USAGE_TAG_PREFIX_CONVERSATION,
  GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN,
} from "@/lib/ai-gateway/runner-gateway-tracking";
import { cn } from "@/lib/utils";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
};

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
 * Pretty label for Gateway tags used by Runneroo (`conversation:…`, `workflow_run:…`, `memory:…`).
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

type GatewayUsagePanelProps = {
  /** Extra classes on the outer wrapper (scroll regions, spacing). */
  className?: string;
};

/**
 * AI Gateway usage for the signed-in user: assistant conversations, workflow runs, and other tagged traffic.
 */
export function GatewayUsagePanel({ className }: GatewayUsagePanelProps) {
  const today = useMemo(() => new Date(), []);

  const [appliedStartDate, setAppliedStartDate] = useState(() =>
    format(startOfMonth(today), "yyyy-MM-dd"),
  );
  const [appliedEndDate, setAppliedEndDate] = useState(() =>
    format(endOfMonth(today), "yyyy-MM-dd"),
  );

  const [draftStartDate, setDraftStartDate] = useState(() =>
    format(startOfMonth(today), "yyyy-MM-dd"),
  );
  const [draftEndDate, setDraftEndDate] = useState(() =>
    format(endOfMonth(today), "yyyy-MM-dd"),
  );

  const [category, setCategory] = useState<GatewayUsageCategoryFilter>("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<SpendReportPagedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* Loads Gateway spend when date range, category tab, or page changes. */
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
  }, [appliedStartDate, appliedEndDate, category, page]);

  const usd = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
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

  return (
    <div className={cn("flex min-h-0 flex-col gap-6", className)}>
      {/* ── Intro ── */}
      <div>
        <h1 className="text-lg font-semibold">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI Gateway spend attributed to your account. Assistant chats are tagged by conversation;
          workflow AI steps are tagged by workflow run. Memory search and writes appear under Other.
        </p>
      </div>

      {/* ── Source scope tabs ── */}
      <Tabs
        value={category}
        onValueChange={(value) => {
          setCategory(value as GatewayUsageCategoryFilter);
          setPage(1);
        }}
        className="w-full min-w-0"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 md:w-auto">
          <TabsTrigger value="all" className="shrink-0">
            All
          </TabsTrigger>
          <TabsTrigger value="assistant" className="shrink-0">
            Assistant
          </TabsTrigger>
          <TabsTrigger value="workflow" className="shrink-0">
            Workflows
          </TabsTrigger>
          <TabsTrigger value="other" className="shrink-0">
            Other
          </TabsTrigger>
        </TabsList>

        <TabsContent value={category} className="mt-4 flex flex-col gap-6">
          {/* ── Date range ── */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDaysIcon className="size-4 shrink-0" aria-hidden />
              Date range
            </div>
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="usage-start">Start</Label>
                <Input
                  id="usage-start"
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="usage-end">End</Label>
                <Input
                  id="usage-end"
                  type="date"
                  value={draftEndDate}
                  onChange={(e) => setDraftEndDate(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
              <Button
                type="button"
                className="sm:mb-0.5"
                onClick={() => {
                  setAppliedStartDate(draftStartDate);
                  setAppliedEndDate(draftEndDate);
                  setPage(1);
                }}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* ── Summary totals ── */}
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">Total usage (filtered)</p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total cost (USD)
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {usd.format(filteredTotalCostUsd)}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Input tokens
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalInputTokens })}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Output tokens
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalOutputTokens })}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reasoning tokens
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalReasoningTokens })}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Requests
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                  {formatTokens({ value: filteredTotalRequests })}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : null}
            {error ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {/* ── Table ── */}
          <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3 text-right">Total cost (USD)</th>
                  <th className="px-4 py-3 text-right">Input tokens</th>
                  <th className="px-4 py-3 text-right">Output tokens</th>
                  <th className="px-4 py-3 text-right">Reasoning tokens</th>
                  <th className="px-4 py-3 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.results.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {loading ? "Loading…" : "No usage for this date range."}
                    </td>
                  </tr>
                ) : (
                  data.results.map((row, index) => {
                    const convId = conversationIdFromTag({ tag: row.tag });
                    const runId = workflowRunIdFromTag({ tag: row.tag });
                    const label = formatUsageTagLabel({ tag: row.tag });

                    return (
                      <tr
                        key={`${effectivePage}-${index}-${row.tag ?? index}`}
                        className="border-b border-border/80 last:border-0"
                      >
                        <td
                          className="max-w-[240px] truncate px-4 py-3 font-mono text-xs"
                          title={row.tag ?? ""}
                        >
                          {/* Conversation → assistant; workflow run → run detail */}
                          {convId ? (
                            <Link
                              href="/app/chat"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {label}
                            </Link>
                          ) : runId ? (
                            <Link
                              href={`/app/run/${encodeURIComponent(runId)}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {label}
                            </Link>
                          ) : (
                            label
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {usd.format(row.totalCost)}
                        </td>
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
                onClick={() =>
                  setPage((previous) => Math.min(maxPage, previous + 1))
                }
              >
                Next
                <ChevronRightIcon className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
