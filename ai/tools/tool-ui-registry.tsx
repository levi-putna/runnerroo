"use client";

import React from "react";
import {
  isToolOrDynamicToolUIPart,
  getToolOrDynamicToolName,
} from "ai";
import type {
  DynamicToolUIPart,
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  UIMessagePart,
  UIDataTypes,
  UITools,
  UIMessage,
} from "ai";

// ─── Re-export SDK types ──────────────────────────────────────────────────────

/** @see DynamicToolUIPart from the `ai` package */
export type { DynamicToolUIPart };

/** @see ChatAddToolApproveResponseFunction from the `ai` package */
export type { ChatAddToolApproveResponseFunction };

export type AnyToolUIPart = UIMessagePart<UIDataTypes, UITools>;

/**
 * Props every tool UI component receives. `addToolOutput` is only required for
 * client-completed tools (for example {@link import('@/ai/tools/utility/ask-question').askQuestion}).
 */
export type ToolUIProps = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/** Component type for a tool UI panel. */
export type ToolUIComponent = React.ComponentType<ToolUIProps>;

import { GenerateRandomNumberUI } from "@/ai/tools/example/generate-random-number-ui";
import { ShowLocationUI } from "@/ai/tools/geo-map/show-location-ui";
import { SearchUserMemoriesUI } from "@/ai/tools/memories/search-user-memories-ui";
import { AskQuestionUI } from "@/ai/tools/utility/ask-question-ui";
import { TavilyCrawlUI } from "@/ai/tools/utility/tavily-crawl-ui";
import { TavilyExtractUI } from "@/ai/tools/utility/tavily-extract-ui";
import { WebSearchUI } from "@/ai/tools/utility/web-search-ui";

const toolUIRegistry: Record<string, ToolUIComponent> = {
  webSearch: WebSearchUI,
  tavilyExtract: TavilyExtractUI,
  tavilyCrawl: TavilyCrawlUI,
  askQuestion: AskQuestionUI,
  generateRandomNumber: GenerateRandomNumberUI,
  showLocation: ShowLocationUI,
  searchUserMemories: SearchUserMemoriesUI,
};

type ToolRendererProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Resolves the registered UI for a tool part (static `tool-*` or `dynamic-tool`).
 */
export function ToolRenderer({ part, addToolApprovalResponse, addToolOutput }: ToolRendererProps) {
  const toolName = getToolOrDynamicToolName(part);
  const Component = toolUIRegistry[toolName];

  if (!Component) return null;

  return (
    <Component
      part={part as DynamicToolUIPart}
      addToolApprovalResponse={addToolApprovalResponse}
      addToolOutput={addToolOutput}
    />
  );
}

export { isToolOrDynamicToolUIPart };
