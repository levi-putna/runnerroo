import type { GatewaySpendReportRow } from "@ai-sdk/gateway";

export type CostsReportPostGatewayArgs = {
  /** Rows returned by `gateway.getSpendReport` with `groupBy: "tag"`. */
  rows: GatewaySpendReportRow[];
  /** One-based page index. */
  page: number;
  /** Rows per page. */
  pageSize: number;
};

export type CostsReportPagedResult = {
  results: GatewaySpendReportRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  /** Sum of totalCost across every row (before slicing). */
  filteredTotalCostUsd: number;
  /** Sum of inputTokens across rows (missing treated as 0). */
  filteredTotalInputTokens: number;
  /** Sum of outputTokens across rows (missing treated as 0). */
  filteredTotalOutputTokens: number;
  /** Sum of reasoningTokens across rows (missing treated as 0). */
  filteredTotalReasoningTokens: number;
  /** Sum of requestCount across rows (missing treated as 0). */
  filteredTotalRequests: number;
};

function tagSortKey(row: GatewaySpendReportRow): string {
  return row.tag ?? "";
}

/**
 * Sorts rows by total cost (descending), paginates, and computes totals for summary widgets.
 */
export function applyAiGatewayCostsQuery({
  rows,
  page,
  pageSize,
}: CostsReportPostGatewayArgs): CostsReportPagedResult {
  const working = [...rows].sort((a, b) => {
    const delta = b.totalCost - a.totalCost;
    if (delta !== 0) return delta;
    return tagSortKey(a).localeCompare(tagSortKey(b), undefined, {
      sensitivity: "base",
    });
  });

  const filteredTotalCostUsd = working.reduce((sum, row) => sum + row.totalCost, 0);

  const filteredTotalInputTokens = working.reduce(
    (sum, row) => sum + (row.inputTokens ?? 0),
    0,
  );

  const filteredTotalOutputTokens = working.reduce(
    (sum, row) => sum + (row.outputTokens ?? 0),
    0,
  );

  const filteredTotalReasoningTokens = working.reduce(
    (sum, row) => sum + (row.reasoningTokens ?? 0),
    0,
  );

  const filteredTotalRequests = working.reduce(
    (sum, row) => sum + (row.requestCount ?? 0),
    0,
  );

  const totalCount = working.length;
  const safePageSize = Math.max(1, pageSize);
  const maxPage = Math.max(1, Math.ceil(totalCount / safePageSize) || 1);
  const safePage = Math.min(Math.max(1, page), maxPage);
  const start = (safePage - 1) * safePageSize;
  const paginatedResults = working.slice(start, start + safePageSize);

  return {
    results: paginatedResults,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    filteredTotalCostUsd,
    filteredTotalInputTokens,
    filteredTotalOutputTokens,
    filteredTotalReasoningTokens,
    filteredTotalRequests,
  };
}
