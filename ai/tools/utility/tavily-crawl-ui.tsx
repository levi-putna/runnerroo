"use client";

import { Globe, AlertTriangle } from "lucide-react";
import type { ChatAddToolApproveResponseFunction, ChatAddToolOutputFunction, DynamicToolUIPart, UIMessage } from "ai";

import { AssistantToolCard } from "@/components/tool/assistant-tool-card";

type CrawlOutput = {
  baseUrl?: string;
  results?: Array<{ url: string; rawContent?: string }>;
};

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Renders Tavily crawl results: pages discovered from a base URL.
 */
export function TavilyCrawlUI({ part }: Props) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    const url =
      typeof part.input === "object" && part.input !== null && "url" in part.input
        ? String((part.input as { url?: string }).url ?? "")
        : "";

    return (
      <AssistantToolCard title="Site crawl" icon={Globe} variant="loading">
        <p className="text-xs text-muted-foreground break-all">{url || "Preparing crawl…"}</p>
      </AssistantToolCard>
    );
  }

  if (part.state === "output-available") {
    const out = part.output as CrawlOutput;
    const rows = out.results ?? [];

    return (
      <AssistantToolCard title="Site crawl" icon={Globe} variant="success">
        {out.baseUrl ? (
          <p className="text-xs text-muted-foreground mb-2 break-all">Base: {out.baseUrl}</p>
        ) : null}
        <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
          {rows.slice(0, 12).map((r) => (
            <li key={r.url} className="break-all">
              <span className="font-medium">{r.url}</span>
              {r.rawContent ? (
                <p className="text-muted-foreground line-clamp-3 mt-0.5">{r.rawContent}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </AssistantToolCard>
    );
  }

  if (part.state === "output-error") {
    return (
      <AssistantToolCard title="Site crawl" icon={Globe} variant="error">
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{part.errorText ?? "Crawl failed."}</span>
        </div>
      </AssistantToolCard>
    );
  }

  return null;
}
