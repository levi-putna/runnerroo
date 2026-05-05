"use client";

import { useAssistantContext } from "@/components/assistant/assistant-context";
import { GATEWAY_MODELS } from "@/lib/ai-gateway/models";
import type { ConversationUsageAggregate } from "@/lib/assistant/aggregate-conversation-usage";
import type { LanguageModelUsage } from "ai";
import { useMemo } from "react";
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

function formatTokens(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value) || value <= 0) return "0";
  return compactFormatter.format(value);
}

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  if (value > 0 && value < 0.0001) return `<${currencyFormatter.format(0.0001)}`;
  return currencyFormatter.format(value);
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
      {children}
    </span>
  );
}

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
      className="mb-1.5 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

function isRecordedUsage(
  aggregate: ConversationUsageAggregate | null
): aggregate is ConversationUsageAggregate {
  return aggregate != null && aggregate.totalTokens > 0 && aggregate.byModel.length > 0;
}

function modelDisplayName({ modelId }: { modelId: string }): string {
  const meta = GATEWAY_MODELS.find((m) => m.id === modelId);
  if (meta?.shortName?.trim()) return meta.shortName;
  const tail = modelId.split("/").filter(Boolean).pop();
  return tail ?? modelId;
}

function UsageByModelTable({
  rows,
}: {
  rows: ConversationUsageAggregate["byModel"];
}) {
  const totals = useMemo(() => {
    let input = 0;
    let output = 0;
    let reasoning = 0;
    let sumTotal = 0;

    for (const row of rows) {
      const cols = sdkUsageColumns(row.usage);
      input += cols.input;
      output += cols.output;
      reasoning += cols.reasoning;
      sumTotal += cols.total;
    }
    return { input, output, reasoning, total: sumTotal };
  }, [rows]);

  const hasReasoning = rows.some(
    (r) => (r.usage.outputTokenDetails?.reasoningTokens ?? 0) > 0
  );
  const hasMultipleRows = rows.length > 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="border-b border-border/40">
            <th className="pb-1 pr-2 text-left font-medium text-muted-foreground/60">
              Model
            </th>
            <th className="pb-1 pr-2 text-right font-medium text-muted-foreground/60">
              In
            </th>
            <th className="pb-1 pr-2 text-right font-medium text-muted-foreground/60">
              Out
            </th>
            {hasReasoning && (
              <th className="pb-1 pr-2 text-right font-medium text-muted-foreground/60">
                Reason
              </th>
            )}
            <th className="pb-1 pr-2 text-right font-medium text-muted-foreground/60">
              Total
            </th>
            <th className="pb-1 text-right font-medium text-muted-foreground/60">
              Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cols = sdkUsageColumns(row.usage);
            return (
              <tr key={row.modelId} className="border-b border-border/20">
                <td className="py-1 pr-2 text-left text-muted-foreground truncate max-w-[80px]">
                  {modelDisplayName({ modelId: row.modelId })}
                </td>
                <td className="py-1 pr-2 text-right text-muted-foreground">
                  {formatTokens(cols.input)}
                </td>
                <td className="py-1 pr-2 text-right text-muted-foreground">
                  {formatTokens(cols.output)}
                </td>
                {hasReasoning && (
                  <td className="py-1 pr-2 text-right text-muted-foreground">
                    {formatTokens(cols.reasoning)}
                  </td>
                )}
                <td className="py-1 pr-2 text-right font-medium text-foreground">
                  {formatTokens(cols.total)}
                </td>
                <td className="py-1 text-right text-muted-foreground">
                  {formatUsd(row.estimatedUsd)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {hasMultipleRows && (
          <tfoot>
            <tr>
              <td className="pt-1 pr-2 text-left font-medium text-muted-foreground">
                Total
              </td>
              <td className="pt-1 pr-2 text-right font-medium">
                {formatTokens(totals.input)}
              </td>
              <td className="pt-1 pr-2 text-right font-medium">
                {formatTokens(totals.output)}
              </td>
              {hasReasoning && (
                <td className="pt-1 pr-2 text-right font-medium">
                  {formatTokens(totals.reasoning)}
                </td>
              )}
              <td className="pt-1 pr-2 text-right font-semibold text-foreground">
                {formatTokens(totals.total)}
              </td>
              <td className="pt-1 text-right font-medium text-foreground">—</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

type ContextUsageSectionProps = {
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

export function ContextUsageSection({ open, onOpenChange }: ContextUsageSectionProps) {
  const { conversationUsageAggregate } = useAssistantContext();
  const controlsId = "context-usage-section-body";
  const hasUsage = isRecordedUsage(conversationUsageAggregate);

  return (
    <section aria-label="Usage" className="flex flex-col">
      <UsageSectionHeader
        open={open}
        controlsId={controlsId}
        onOpenChange={onOpenChange}
      />

      {open && (
        <div id={controlsId} className="flex flex-col gap-2">
          {hasUsage ? (
            <UsageByModelTable rows={conversationUsageAggregate.byModel} />
          ) : (
            <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground/50">
              No usage recorded yet
            </p>
          )}
        </div>
      )}
    </section>
  );
}
