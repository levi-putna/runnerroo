"use client";

import { useAssistantContext } from "@/components/assistant/assistant-context";
import type { GatewayModel } from "@/lib/ai-gateway/types";
import type { ConversationUsageAggregate } from "@/lib/assistant/aggregate-conversation-usage";
import type { LanguageModelUsage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * Formats a token count using compact notation (matches streamed totals).
 */
function formatTokens(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value) || value <= 0) {
    return "0";
  }
  return compactFormatter.format(value);
}

/**
 * Formats an approximate USD amount when catalogue pricing was available server-side.
 */
function formatUsd(value: number | null): string {
  if (value === null) {
    return "—";
  }
  if (value > 0 && value < 0.000_1) {
    return `<${currencyFormatter.format(0.000_1)}`;
  }
  return currencyFormatter.format(value);
}

/**
 * Reads display columns from {@link LanguageModelUsage} exactly as returned by the AI SDK.
 */
function sdkUsageColumns(usage: LanguageModelUsage): {
  input: number;
  output: number;
  reasoning: number;
  total: number;
} {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const reasoning = usage.outputTokenDetails?.reasoningTokens ?? 0;
  const total =
    typeof usage.totalTokens === "number" && !Number.isNaN(usage.totalTokens)
      ? usage.totalTokens
      : input + output;

  return { input, output, reasoning, total };
}

/** Matches the section heading used in {@link ContextSidebar}. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-foreground">
      {children}
    </span>
  );
}

/**
 * Header for collapsing/expanding the session usage section.
 */
function UsageSectionHeader({
  open,
  controlsId,
  onOpenChange,
}: {
  open: boolean;
  controlsId: string;
  onOpenChange: (nextOpen: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="mb-1.5 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={() => onOpenChange(!open)}
    >
      <SectionLabel>Usage</SectionLabel>
      <ChevronDownIcon
        className={`size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
        aria-hidden
      />
    </button>
  );
}

/**
 * Narrows aggregate after we know the session has streamed usage metadata.
 */
function isRecordedUsage(
  aggregate: ConversationUsageAggregate | null
): aggregate is ConversationUsageAggregate {
  return (
    aggregate != null &&
    aggregate.totalTokens > 0 &&
    aggregate.byModel.length > 0
  );
}

/**
 * Resolves a catalogue display title for a Gateway model id.
 */
function modelDisplayName({
  modelId,
  catalogueModels,
}: {
  modelId: string;
  catalogueModels: GatewayModel[] | null | undefined;
}): string {
  const meta = catalogueModels?.find((m) => m.id === modelId);
  if (meta?.shortName?.trim()) {
    return meta.shortName;
  }
  const tail = modelId.split("/").filter(Boolean).pop();
  return tail ?? modelId;
}

/**
 * Compact per-model usage table: SDK input / output / reasoning / total plus footer totals.
 */
function UsageByModelTable({
  rows,
  catalogueModels,
}: {
  rows: ConversationUsageAggregate["byModel"];
  catalogueModels: GatewayModel[] | null;
}) {
  const totals = useMemo(() => {
    let input = 0;
    let output = 0;
    let reasoning = 0;
    let sumTotal = 0;
    for (const row of rows) {
      const c = sdkUsageColumns(row.usage);
      input += c.input;
      output += c.output;
      reasoning += c.reasoning;
      sumTotal += c.total;
    }
    return { input, output, reasoning, sumTotal };
  }, [rows]);

  return (
    <div className="mt-2 overflow-x-auto rounded border border-border/50 bg-muted/15">
      <table className="w-full border-collapse text-[10px] tabular-nums">
        <caption className="sr-only">
          Token usage by model from the assistant session metadata
        </caption>
        <thead>
          <tr className="border-b border-border/50 bg-muted/25 text-muted-foreground">
            <th scope="col" className="max-w-[7rem] truncate py-1 pl-2 pr-1 text-left font-medium">
              Model
            </th>
            <th scope="col" className="px-1 py-1 text-right font-medium">
              In
            </th>
            <th scope="col" className="px-1 py-1 text-right font-medium">
              Out
            </th>
            <th scope="col" className="whitespace-nowrap px-1 py-1 text-right font-medium">
              Reasoning
            </th>
            <th scope="col" className="py-1 pl-1 pr-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          {rows.map((row) => {
            const c = sdkUsageColumns(row.usage);
            const name = modelDisplayName({
              modelId: row.modelId,
              catalogueModels,
            });

            return (
              <tr
                key={row.modelId}
                className="border-b border-border/40 last:border-b-0 hover:bg-muted/20"
              >
                <td className="max-w-[7rem] truncate py-1 pl-2 pr-1 text-left font-medium leading-tight">
                  {name}
                </td>
                <td className="px-1 py-1 text-right">{formatTokens(c.input)}</td>
                <td className="px-1 py-1 text-right">{formatTokens(c.output)}</td>
                <td className="px-1 py-1 text-right">{formatTokens(c.reasoning)}</td>
                <td className="py-1 pl-1 pr-2 text-right">{formatTokens(c.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/60 bg-muted/20 font-medium text-foreground">
            <td className="py-1 pl-2 pr-1 text-left">Total</td>
            <td className="px-1 py-1 text-right">{formatTokens(totals.input)}</td>
            <td className="px-1 py-1 text-right">{formatTokens(totals.output)}</td>
            <td className="px-1 py-1 text-right">{formatTokens(totals.reasoning)}</td>
            <td className="py-1 pl-1 pr-2 text-right">{formatTokens(totals.sumTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Session token usage for the Context sidebar: conversation token total plus SDK-backed table by model.
 */
export function ContextUsageSection({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
} = {}) {
  const { conversationUsageAggregate } = useAssistantContext();
  const [catalogueModels, setCatalogueModels] = useState<GatewayModel[] | null>(null);
  const [internalOpen, setInternalOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/ai-gateway/models");
        const json = (await response.json()) as {
          models?: GatewayModel[];
        };
        if (!cancelled && Array.isArray(json.models)) {
          setCatalogueModels(json.models);
        }
      } catch {
        if (!cancelled) {
          setCatalogueModels([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregate = conversationUsageAggregate;
  const isRecorded = isRecordedUsage(aggregate);
  const usageContentId = "context-sidebar-section-usage";

  const open = controlledOpen ?? internalOpen;

  /**
   * Handles controlled/uncontrolled open state for the section.
   */
  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <section aria-label="Session usage">
      <UsageSectionHeader
        open={open}
        controlsId={usageContentId}
        onOpenChange={handleOpenChange}
      />

      <div id={usageContentId} role="region" hidden={!open}>
        {isRecorded ? (
          <div className="rounded-md border border-border/60 bg-background px-3 py-2.5">
            {/* This conversation — cumulative tokens across all models/phases in this chat */}
            <p className="text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">This conversation:</span>{" "}
              <span className="tabular-nums text-foreground">{formatTokens(aggregate.totalTokens)}</span>{" "}
              tokens
            </p>

            {/* Session cost — separate from SDK token columns */}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Session estimate{" "}
              {aggregate.totalEstimatedUsd != null ? (
                <span className="font-medium text-foreground tabular-nums">
                  {formatUsd(aggregate.totalEstimatedUsd)}
                </span>
              ) : (
                <span className="text-muted-foreground/80">not available</span>
              )}
              <span className="block text-[10px] font-normal text-muted-foreground/70">
                Costs use Gateway catalogue pricing. Tokens below are from streamed AI SDK usage.
              </span>
            </p>

            {/* Per-request models merged by id — columns match LanguageModelUsage */}
            <UsageByModelTable rows={aggregate.byModel} catalogueModels={catalogueModels} />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground/50">
            No usage data yet.
          </p>
        )}
      </div>
    </section>
  );
}
