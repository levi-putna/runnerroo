"use client";

import { BrainIcon } from "lucide-react";
import type {
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  DynamicToolUIPart,
  UIMessage,
} from "ai";

import { AssistantToolCard } from "@/components/tool/assistant-tool-card";

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Renders tool output for searchUserMemories.
 */
export function SearchUserMemoriesUI({ part }: Props) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <AssistantToolCard title="Search User Memories" icon={BrainIcon} variant="loading">
        <p className="text-xs text-muted-foreground">Searching memory store...</p>
      </AssistantToolCard>
    );
  }

  if (part.state === "output-available") {
    const output = part.output as {
      memories?: Array<{ type: string; content: string }>;
    };

    return (
      <AssistantToolCard title="Search User Memories" icon={BrainIcon} variant="success">
        <div className="space-y-1 text-xs">
          {(output.memories ?? []).length === 0 ? (
            <p className="text-muted-foreground">No matching memories found.</p>
          ) : (
            output.memories?.slice(0, 4).map((memory, index) => (
              <p key={`${memory.type}-${index}`}>
                [{memory.type}] {memory.content}
              </p>
            ))
          )}
        </div>
      </AssistantToolCard>
    );
  }

  if (part.state === "output-error") {
    return (
      <AssistantToolCard title="Search User Memories" icon={BrainIcon} variant="error">
        <p className="text-xs text-destructive">{part.errorText ?? "Memory search failed."}</p>
      </AssistantToolCard>
    );
  }

  return null;
}
