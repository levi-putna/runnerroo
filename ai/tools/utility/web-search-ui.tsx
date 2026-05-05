"use client";

import { Search, AlertTriangle } from "lucide-react";
import type {
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  DynamicToolUIPart,
  UIMessage,
} from "ai";

import { AssistantToolCard } from "@/components/tool/assistant-tool-card";

type TavilySearchOutput = {
  answer?: string;
  query?: string;
  results?: Array<{ title?: string; url: string; content?: string }>;
};

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Renders web search tool states: loading, results list, or error.
 */
export function WebSearchUI({ part }: Props) {
  // ─── Loading / awaiting execution ────────────────────────────────────────
  if (part.state === "input-streaming" || part.state === "input-available") {
    const query =
      typeof part.input === "object" && part.input !== null && "query" in part.input
        ? String((part.input as { query?: string }).query ?? "")
        : "";

    return (
      <AssistantToolCard title="Web search" icon={Search} variant="loading">
        <p className="text-xs text-muted-foreground">
          {query ? `Searching for: ${query}` : "Preparing search…"}
        </p>
      </AssistantToolCard>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  if (part.state === "output-available") {
    const out = part.output as TavilySearchOutput;
    const results = out.results ?? [];

    return (
      <AssistantToolCard title="Web search" icon={Search} variant="success">
        {out.answer ? (
          <p className="text-xs whitespace-pre-wrap border-b border-border pb-2 mb-2">{out.answer}</p>
        ) : null}
        <ul className="space-y-2 text-xs">
          {results.slice(0, 8).map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {r.title ?? r.url}
              </a>
              {r.content ? (
                <p className="text-muted-foreground line-clamp-2 mt-0.5">{r.content}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </AssistantToolCard>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (part.state === "output-error") {
    return (
      <AssistantToolCard title="Web search" icon={Search} variant="error">
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{part.errorText ?? "Search failed."}</span>
        </div>
      </AssistantToolCard>
    );
  }

  return null;
}
