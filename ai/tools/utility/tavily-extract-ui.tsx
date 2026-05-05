"use client";

import { FileText, AlertTriangle } from "lucide-react";
import type { ChatAddToolApproveResponseFunction, ChatAddToolOutputFunction, DynamicToolUIPart, UIMessage } from "ai";

import { AssistantToolCard } from "@/components/tool/assistant-tool-card";

type ExtractOutput = {
  results?: Array<{ url: string; title?: string | null; rawContent?: string }>;
  failedResults?: Array<{ url: string; error: string }>;
};

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Renders Tavily URL extract results (and any per-URL failures).
 */
export function TavilyExtractUI({ part }: Props) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    const urls =
      typeof part.input === "object" && part.input !== null && "urls" in part.input
        ? (part.input as { urls?: string[] }).urls
        : undefined;

    return (
      <AssistantToolCard title="Extract pages" icon={FileText} variant="loading">
        <p className="text-xs text-muted-foreground">
          {urls?.length ? `Extracting ${urls.length} URL(s)…` : "Preparing extract…"}
        </p>
      </AssistantToolCard>
    );
  }

  if (part.state === "output-available") {
    const out = part.output as ExtractOutput;
    const ok = out.results ?? [];
    const failed = out.failedResults ?? [];

    return (
      <AssistantToolCard title="Extract pages" icon={FileText} variant="success">
        <ul className="max-h-56 space-y-3 overflow-y-auto text-xs">
          {ok.map((r) => (
            <li key={r.url} className="break-all">
              <div className="font-medium">{r.title ?? r.url}</div>
              {r.rawContent ? (
                <p className="text-muted-foreground line-clamp-4 mt-0.5">{r.rawContent}</p>
              ) : null}
            </li>
          ))}
        </ul>
        {failed.length > 0 ? (
          <div className="mt-2 border-t border-border pt-2 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-medium">Some URLs failed</p>
            <ul className="mt-1 list-disc pl-4">
              {failed.map((f) => (
                <li key={f.url}>
                  {f.url}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </AssistantToolCard>
    );
  }

  if (part.state === "output-error") {
    return (
      <AssistantToolCard title="Extract pages" icon={FileText} variant="error">
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{part.errorText ?? "Extract failed."}</span>
        </div>
      </AssistantToolCard>
    );
  }

  return null;
}
