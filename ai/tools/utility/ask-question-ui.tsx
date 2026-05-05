"use client";

import { MessageCircleQuestion } from "lucide-react";
import type {
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  DynamicToolUIPart,
  UIMessage,
} from "ai";

import { AssistantToolCard } from "@/components/tool/assistant-tool-card";
import { Button } from "@/components/ui/button";

type AskInput = {
  question?: string;
  options?: string[];
};

type AskOutput = {
  selectedOption: string;
};

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * User-interaction tool: show options; completion is sent with {@link ChatAddToolOutputFunction}.
 */
export function AskQuestionUI({ part, addToolOutput }: Props) {
  const input = (part.state === "input-available" || part.state === "input-streaming"
    ? part.input
    : part.state === "output-available"
      ? part.input
      : {}) as AskInput;
  const question = input.question ?? "";
  const options = Array.isArray(input.options) ? input.options : [];

  // ─── Model still streaming arguments ───────────────────────────────────────
  if (part.state === "input-streaming") {
    return (
      <AssistantToolCard title="Question" icon={MessageCircleQuestion} variant="loading">
        <p className="text-xs text-muted-foreground">Preparing choices…</p>
      </AssistantToolCard>
    );
  }

  // ─── Awaiting user selection (no server execute) ───────────────────────────
  if (part.state === "input-available") {
    return (
      <AssistantToolCard title="Question for you" icon={MessageCircleQuestion}>
        <p className="text-sm font-medium mb-3">{question || "Please choose an option."}</p>
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <Button
              key={opt}
              type="button"
              variant="secondary"
              size="sm"
              className="justify-start text-left h-auto py-2 whitespace-normal"
              disabled={!addToolOutput}
              onClick={() => {
                addToolOutput?.({
                  tool: "askQuestion",
                  toolCallId: part.toolCallId,
                  output: { selectedOption: opt } satisfies AskOutput,
                });
              }}
            >
              {opt}
            </Button>
          ))}
        </div>
        {!addToolOutput ? (
          <p className="text-xs text-muted-foreground mt-2">Tool output handler is not wired.</p>
        ) : null}
      </AssistantToolCard>
    );
  }

  // ─── Answered ────────────────────────────────────────────────────────────
  if (part.state === "output-available") {
    const out = part.output as AskOutput;

    return (
      <AssistantToolCard title="Your answer" icon={MessageCircleQuestion} variant="success">
        <p className="text-xs text-muted-foreground mb-1">You selected:</p>
        <p className="text-sm font-medium">{out.selectedOption}</p>
      </AssistantToolCard>
    );
  }

  if (part.state === "output-error") {
    return (
      <AssistantToolCard title="Question" icon={MessageCircleQuestion} variant="error">
        <p className="text-xs text-destructive">{part.errorText ?? "Something went wrong."}</p>
      </AssistantToolCard>
    );
  }

  return null;
}
