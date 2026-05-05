"use client";

import { aggregateConversationUsageFromMessages } from "@/lib/assistant/aggregate-conversation-usage";
import { useAssistantContext } from "@/components/assistant/assistant-context";
import { ModelSelector } from "@/components/model-selector";
import { useSelectedChatModel } from "@/hooks/use-selected-chat-model";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type UIMessage,
  isReasoningUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { BotIcon, CornerDownLeftIcon, CopyIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { ChatAddToolApproveResponseFunction, ChatAddToolOutputFunction, ChatStatus } from "ai";

import { isToolOrDynamicToolUIPart, ToolRenderer } from "@/ai/tools/tool-ui-registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function RunnerChatEmptyState() {
  return (
    <ConversationEmptyState
      icon={<SparklesIcon className="size-8" />}
      title="How can I help?"
      description="Start a conversation to get assistance with any task."
    />
  );
}

// ─── Message list ─────────────────────────────────────────────────────────────

/**
 * Renders chat messages; assistant reasoning uses {@link Reasoning} with all reasoning
 * parts merged into one block (see AI Elements reasoning guidance).
 */
function MessageList({
  messages,
  status,
  addToolApprovalResponse,
  addToolOutput,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput: ChatAddToolOutputFunction<UIMessage>;
}) {
  return (
    <>
      {messages.map((message, messageIndex) => {
        if (message.role === "user") {
          return (
            <Message key={message.id} from="user">
              <MessageContent>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={part.url}
                        alt="attachment"
                        className="max-w-xs rounded-md"
                      />
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          );
        }

        if (message.role === "assistant") {
          const isLastMessage = messageIndex === messages.length - 1;
          const isStreaming =
            status === "streaming" && messages[messages.length - 1]?.id === message.id;

          const reasoningParts = message.parts.filter((p) => isReasoningUIPart(p));
          const reasoningText = reasoningParts.map((p) => p.text).join("\n\n");
          const hasReasoning = reasoningParts.length > 0;
          const lastPart = message.parts.at(-1);
          const isReasoningStreaming =
            isLastMessage &&
            isStreaming &&
            !!lastPart &&
            isReasoningUIPart(lastPart);

          return (
            <Message key={message.id} from="assistant">
              <MessageContent>
                {/* Single Reasoning block — matches AI Elements guidance for models that emit multiple reasoning parts. */}
                {hasReasoning ? (
                  <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
                    <ReasoningTrigger />
                    <ReasoningContent>{reasoningText}</ReasoningContent>
                  </Reasoning>
                ) : null}
                {message.parts.map((part, i) => {
                  if (isReasoningUIPart(part)) {
                    return null;
                  }
                  if (part.type === "text") {
                    return (
                      <MessageResponse key={`${message.id}-part-${i}`} isAnimating={isStreaming}>
                        {part.text}
                      </MessageResponse>
                    );
                  }
                  if (isToolOrDynamicToolUIPart(part)) {
                    return (
                      <div key={`${message.id}-part-${i}`} className="not-prose w-full min-w-0">
                        <ToolRenderer
                          part={part}
                          addToolApprovalResponse={addToolApprovalResponse}
                          addToolOutput={addToolOutput}
                        />
                      </div>
                    );
                  }
                  return null;
                })}
              </MessageContent>
              {!isStreaming && (
                <MessageActions>
                  <MessageAction
                    tooltip="Copy"
                    label="Copy message"
                    onClick={() => {
                      const text = getTextFromMessage(message);
                      void navigator.clipboard.writeText(text);
                    }}
                  >
                    <CopyIcon className="size-3.5" />
                  </MessageAction>
                </MessageActions>
              )}
            </Message>
          );
        }

        return null;
      })}

      {status === "submitted" && (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BotIcon className="size-4 animate-pulse" />
              <span>Thinking…</span>
            </div>
          </MessageContent>
        </Message>
      )}
    </>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

/**
 * Prompt area: height follows content (not a tall empty panel). The textarea uses
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing | field-sizing}
 * to grow with text up to ~five lines, then scrolls.
 */
function Composer({
  status,
  onStop,
  onSend,
  modelId,
  onModelChange,
}: {
  status: ChatStatus;
  onStop: () => void;
  onSend: (text: string) => void;
  modelId: string;
  onModelChange: ({ modelId }: { modelId: string }) => void;
}) {
  const [localInput, setLocalInput] = useState("");
  const isActive = status === "streaming" || status === "submitted";
  const promptInputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const focusPrompt = useCallback(() => {
    if (isActive) return;
    textareaRef.current?.focus();
  }, [isActive]);

  const handleInputGroupSurfaceClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement;
      if (t.closest("button") || t.closest("[data-slot=input-group-addon]")) {
        return;
      }
      if (t.closest("[data-slot=input-group-control]")) {
        return;
      }
      focusPrompt();
    },
    [focusPrompt]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isActive && localInput.trim()) {
        onSend(localInput.trim());
        setLocalInput("");
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isActive && localInput.trim()) {
      onSend(localInput.trim());
      setLocalInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col">
      <label htmlFor={promptInputId} className="sr-only">
        Message
      </label>
      {/* items-stretch: full width in column layout (InputGroup defaults to items-centre). */}
      <InputGroup
        className="h-auto flex-col items-stretch py-1"
        onClick={handleInputGroupSurfaceClick}
      >
        <textarea
          ref={textareaRef}
          id={promptInputId}
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Runneroo…"
          disabled={isActive}
          rows={1}
          className="field-sizing-content max-h-[calc(5lh+1rem)] min-h-[2.5rem] w-full overflow-y-auto resize-none rounded-none border-0 bg-transparent px-3 py-2 text-sm shadow-none ring-0 outline-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent"
          data-slot="input-group-control"
        />
        <InputGroupAddon align="block-end" className="flex w-full shrink-0 items-center justify-between px-1 py-1">
          <ModelSelector
            selectedModelId={modelId}
            onModelChange={onModelChange}
            disabled={isActive}
            modelType="text"
            triggerClassName="h-auto min-h-7 max-w-[min(100vw,14rem)] gap-1.5 border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground"
          />
          {isActive ? (
            <InputGroupButton type="button" onClick={onStop} size="xs">
              <SquareIcon className="size-3.5 fill-current" />
            </InputGroupButton>
          ) : (
            <InputGroupButton type="submit" disabled={!localInput.trim()} size="xs">
              <CornerDownLeftIcon className="size-3.5" />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export type RunnerChatProps = {
  conversationId: string;
};

export function RunnerChat({ conversationId }: RunnerChatProps) {
  const {
    activeConversationMessages,
    saveConversation,
    flushSave,
    syncConversationFromRemoteDetail,
    takePendingForkSend,
    setConversationUsageAggregate,
    setConversationTitle,
    stripTargetMemoryIdRef,
    chatMemoryStripNonce,
  } = useAssistantContext();

  const { modelId, setModelId } = useSelectedChatModel();

  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status,
    addToolApprovalResponse,
    addToolOutput,
  } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId, modelId },
    }),
    messages: activeConversationMessages ?? undefined,
    // After client-completed tools (e.g. askQuestion) call addToolOutput, continue the model turn automatically.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Receive the AI-generated conversation title streamed before the main response.
    onData: (part) => {
      if (part.type === "data-conversation-title") {
        const data = part.data as { title?: string };
        if (typeof data?.title === "string" && data.title.trim()) {
          setConversationTitle({ id: conversationId, title: data.title.trim() });
        }
      }
    },
  });

  // ── Memory strip on nonce change ──────────────────────────────────────────
  useEffect(() => {
    const targetId = stripTargetMemoryIdRef.current;
    if (!targetId) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.role !== "assistant") return msg;
        const meta = msg.metadata as Record<string, unknown> | undefined;
        if (!meta) return msg;
        const memoriesRetrieved = Array.isArray(meta.memoriesRetrieved)
          ? (meta.memoriesRetrieved as Array<{ id?: string }>).filter((m) => m.id !== targetId)
          : meta.memoriesRetrieved;
        return { ...msg, metadata: { ...meta, memoriesRetrieved } };
      })
    );
  }, [chatMemoryStripNonce, stripTargetMemoryIdRef, setMessages]);

  // ── Save on message change ────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    saveConversation(conversationId, messages);
  }, [messages, conversationId, saveConversation]);

  // ── Flush save when streaming ends ────────────────────────────────────────
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isNowReady = status === "ready";
    if (wasStreaming && isNowReady) {
      flushSave(conversationId);
      syncConversationFromRemoteDetail({ conversationId });
    }
    prevStatusRef.current = status;
  }, [status, conversationId, flushSave, syncConversationFromRemoteDetail]);

  // ── Usage aggregate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    const aggregate = aggregateConversationUsageFromMessages(messages);
    setConversationUsageAggregate({ aggregate: aggregate.totalTokens > 0 ? aggregate : null });
  }, [messages, setConversationUsageAggregate]);

  // ── Replay fork send ──────────────────────────────────────────────────────
  useEffect(() => {
    const payload = takePendingForkSend();
    if (!payload) return;
    void sendMessage({ text: payload.text });
  }, [takePendingForkSend, sendMessage]);

  const handleSend = useCallback(
    (text: string) => {
      void sendMessage({ text });
    },
    [sendMessage]
  );

  /** ~210mm (A4 width); header stays full width in AssistantShell. */
  const readingMaxClass = "mx-auto w-full max-w-[210mm]";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages — full width so scrollbar sits at viewport edge; content capped at ~A4 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation className="flex-1">
          <ConversationContent className={cn("mx-auto w-full max-w-[210mm]")}>
            {messages.length === 0 ? (
              <RunnerChatEmptyState />
            ) : (
              <MessageList
                messages={messages}
                status={status}
                addToolApprovalResponse={addToolApprovalResponse}
                addToolOutput={addToolOutput}
              />
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Composer — height from content; textarea caps ~5 visible lines then scrolls */}
      <div className="flex shrink-0 flex-col border-t bg-background">
        <div className={cn("flex flex-col px-4 py-3", readingMaxClass)}>
          <Composer
            status={status}
            onStop={stop}
            onSend={handleSend}
            modelId={modelId}
            onModelChange={setModelId}
          />
        </div>
      </div>
    </div>
  );
}
