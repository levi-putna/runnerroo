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

import { ShowDocumentDownloadUI } from "@/ai/tools/documents/show-document-download-ui";
import { GenerateRandomNumberUI } from "@/ai/tools/example/generate-random-number-ui";
import { ShowLocationUI } from "@/ai/tools/geo-map/show-location-ui";
import { SearchUserMemoriesUI } from "@/ai/tools/memories/search-user-memories-ui";
import { AskQuestionUI } from "@/ai/tools/utility/ask-question-ui";
import { TavilyCrawlUI } from "@/ai/tools/utility/tavily-crawl-ui";
import { TavilyExtractUI } from "@/ai/tools/utility/tavily-extract-ui";
import { WebSearchUI } from "@/ai/tools/utility/web-search-ui";
import { WorkflowInvokeToolUI } from "@/ai/tools/workflows/workflow-invoke-ui";
import { isWorkflowAssistantToolName } from "@/lib/workflows/assistant-workflow-invoke-support";

const toolUIRegistry: Record<string, ToolUIComponent> = {
  webSearch: WebSearchUI,
  tavilyExtract: TavilyExtractUI,
  tavilyCrawl: TavilyCrawlUI,
  askQuestion: AskQuestionUI,
  generateRandomNumber: GenerateRandomNumberUI,
  showDocumentDownload: ShowDocumentDownloadUI,
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
 * Wrapped in `w-full min-w-0` so every tool aligns with the assistant column width and loading vs loaded states do not change horizontal sizing.
 */
export function ToolRenderer({ part, addToolApprovalResponse, addToolOutput }: ToolRendererProps) {
  const toolName = getToolOrDynamicToolName(part);

  if (isWorkflowAssistantToolName({ toolName })) {
    return (
      <div className="w-full min-w-0">
        <WorkflowInvokeToolUI
          part={part as DynamicToolUIPart}
          addToolApprovalResponse={addToolApprovalResponse}
          addToolOutput={addToolOutput}
        />
      </div>
    );
  }

  const Component = toolUIRegistry[toolName];

  if (!Component) return null;

  return (
    <div className="w-full min-w-0">
      <Component
        part={part as DynamicToolUIPart}
        addToolApprovalResponse={addToolApprovalResponse}
        addToolOutput={addToolOutput}
      />
    </div>
  );
}

export { isToolOrDynamicToolUIPart };
