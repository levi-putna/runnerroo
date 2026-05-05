import { gateway } from "@ai-sdk/gateway";
import { NextResponse } from "next/server";

import { applyAiGatewayCostsQuery } from "@/lib/admin/apply-ai-gateway-costs-query";
import type { GatewayUsageCategoryFilter } from "@/lib/ai-gateway/gateway-usage-category";
import {
  GATEWAY_USAGE_TAG_PREFIX_CONVERSATION,
  GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN,
} from "@/lib/ai-gateway/runner-gateway-tracking";
import { createClient } from "@/lib/supabase/server";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Matches client pagination; rows beyond this use Next page. */
const COSTS_PAGE_SIZE = 50;

function normaliseCategory(raw: string | null): GatewayUsageCategoryFilter {
  if (raw === "assistant" || raw === "workflow" || raw === "other") {
    return raw;
  }
  return "all";
}

function tagMatchesUsageCategory({
  tag,
  category,
}: {
  tag: string | undefined;
  category: GatewayUsageCategoryFilter;
}): boolean {
  if (category === "all") return true;
  const t = (tag ?? "").trim();
  const lower = t.toLowerCase();
  const isConversation = lower.startsWith(GATEWAY_USAGE_TAG_PREFIX_CONVERSATION.toLowerCase());
  const isWorkflowRun = lower.startsWith(GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN.toLowerCase());
  if (category === "assistant") return isConversation;
  if (category === "workflow") return isWorkflowRun;
  /** `other` — embeddings and any future tags */
  return !isConversation && !isWorkflowRun;
}

/**
 * GET `/api/usage/gateway` — AI Gateway spend for the signed-in user (optional tag-category filter + pagination).
 *
 * Query parameters:
 * - **startDate**, **endDate** — required `YYYY-MM-DD` (inclusive).
 * - **page** — optional one-based page index (default `1`).
 * - **category** — optional `all` | `assistant` | `workflow` | `other`.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    return NextResponse.json(
      { error: "Expected startDate and endDate as YYYY-MM-DD ISO dates." },
      { status: 400 },
    );
  }

  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const category = normaliseCategory(searchParams.get("category"));

  const report = await gateway.getSpendReport({
    startDate,
    endDate,
    groupBy: "tag",
    userId: user.id,
  });

  const filteredRows = report.results.filter((row) =>
    tagMatchesUsageCategory({ tag: row.tag, category }),
  );

  const paged = applyAiGatewayCostsQuery({
    rows: filteredRows,
    page,
    pageSize: COSTS_PAGE_SIZE,
  });

  return NextResponse.json({ ...paged, category });
}
