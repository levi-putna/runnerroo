"use client";

import { aggregateConversationUsageFromMessages } from "@/lib/assistant/aggregate-conversation-usage";
import { useAssistantContext } from "@/components/assistant/assistant-context";
import { ModelSelector } from "@/components/model-selector";
import { useSelectedChatModel } from "@/hooks/use-selected-chat-model";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type UIMessage,
  getToolOrDynamicToolName,
  isReasoningUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { Shimmer } from "@/components/ai-elements/shimmer";
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
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CornerDownLeftIcon,
  CopyIcon,
  PencilIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { flushSync } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import type { ChatAddToolApproveResponseFunction, ChatAddToolOutputFunction, ChatStatus } from "ai";

import {
  hasAssistantToolInlineUI,
  isToolOrDynamicToolUIPart,
  ToolRenderer,
} from "@/ai/tools/tool-ui-registry";
import { ASSISTANT_PLANNING_AWAITING_HEADLINES } from "@/lib/assistant/assistant-planning-awaiting-headline";
import { isRunnerAssistantStreamChromePart } from "@/lib/assistant/assistant-ui-stream-chrome";
import { parseSidebarPreviewPayload } from "@/lib/conversations/sidebar-memory-preview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Plain text from a UI message for editing and copy. Prefers `parts`; some stored rows only
 * expose a legacy `content` string.
 */
function getTextFromMessage(message: UIMessage): string {
  const fromParts =
    message.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("") ?? "";
  if (fromParts.trim().length > 0) {
    return fromParts;
  }
  const legacy = (message as { content?: unknown }).content;
  if (typeof legacy === "string") {
    return legacy;
  }
  return "";
}

const AWAITING_ROTATE_MS_MIN = 3000;
const AWAITING_ROTATE_MS_MAX = 6000;

/**
 * Returns a delay in milliseconds between {@link AWAITING_ROTATE_MS_MIN} and {@link AWAITING_ROTATE_MS_MAX} inclusive.
 */
function randomAwaitingRotateDelayMs(): number {
  return AWAITING_ROTATE_MS_MIN + Math.floor(Math.random() * (AWAITING_ROTATE_MS_MAX - AWAITING_ROTATE_MS_MIN + 1));
}

/**
 * Picks a random index into {@link ASSISTANT_PLANNING_AWAITING_HEADLINES} that differs from the current line.
 */
function pickRandomAwaitingLineIndexExcluding({ excludeIndex }: { excludeIndex: number }): number {
  const len = ASSISTANT_PLANNING_AWAITING_HEADLINES.length;
  if (len <= 1) return 0;
  let next = excludeIndex;
  while (next === excludeIndex) {
    next = Math.floor(Math.random() * len);
  }
  return next;
}

/**
 * Whether an assistant {@link UIMessage} already shows streamed output users can see
 * (text or an inline tool card). When false during streaming, we show a skeleton so the gap
 * before the first token is not mistaken for an error.
 */
function assistantMessageHasRenderableBody({ message }: { message: UIMessage }): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  for (const part of message.parts) {
    if (isReasoningUIPart(part)) {
      continue;
    }
    if (part.type === "text" && part.text.trim().length > 0) {
      return true;
    }
    if (isToolOrDynamicToolUIPart(part)) {
      const toolName = getToolOrDynamicToolName(part);
      if (hasAssistantToolInlineUI({ toolName })) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Skeleton and status copy shown while the assistant message exists but no body yet,
 * or while the request is submitted before streaming begins. Status copy rotates on a 3–6s cadence.
 */
function AssistantAwaitingResponsePlaceholder() {
  const [lineIndex, setLineIndex] = useState(() =>
    Math.floor(Math.random() * ASSISTANT_PLANNING_AWAITING_HEADLINES.length),
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setLineIndex((prev) => pickRandomAwaitingLineIndexExcluding({ excludeIndex: prev }));
        scheduleNext();
      }, randomAwaitingRotateDelayMs());
    };

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const line = ASSISTANT_PLANNING_AWAITING_HEADLINES[lineIndex];

  return (
    <div
      className="flex w-full flex-col gap-2.5 py-0.5"
      aria-busy="true"
      aria-label="Assistant is preparing a response"
    >
      {/* Status line — client-side rotating copy while waiting for streamed body */}
      <Shimmer as="p" className="text-xs text-muted-foreground">
        {line}
      </Shimmer>
      {/* Skeleton lines — approximate message shape */}
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-3.5 w-[min(100%,28rem)]" />
        <Skeleton className="h-3.5 w-[min(100%,22rem)]" />
        <Skeleton className="h-3.5 w-[min(100%,24rem)]" />
      </div>
    </div>
  );
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
 * Renders chat messages; model reasoning is kept server-side — the thread only shows streamed
 * text, tools, and the awaiting placeholder until the answer body begins.
 */
function MessageList({
  messages,
  status,
  addToolApprovalResponse,
  addToolOutput,
  canEditOrCopy,
  onBeginEditUserMessage,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput: ChatAddToolOutputFunction<UIMessage>;
  canEditOrCopy: boolean;
  onBeginEditUserMessage: ({
    messageIndex,
    message,
  }: {
    messageIndex: number;
    message: UIMessage;
  }) => void;
}) {
  return (
    <>
      {messages.map((message, messageIndex) => {
        if (message.role === "user") {
          const userText = getTextFromMessage(message);
          const showEdit = canEditOrCopy && userText.trim().length > 0;

          return (
            <Message key={message.id} from="user">
              {/* User bubble + metadata */}
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
              {showEdit ? (
                <MessageActions
                  className={cn(
                    "self-end",
                    // Always allow taps — `pointer-events-none` until hover breaks touch and some trackpads.
                    "text-muted-foreground opacity-80 transition-opacity hover:opacity-100"
                  )}
                >
                  <MessageAction
                    tooltip="Edit"
                    label="Edit message"
                    onClick={() => {
                      onBeginEditUserMessage({ messageIndex, message });
                    }}
                  >
                    <PencilIcon className="size-3.5" />
                  </MessageAction>
                </MessageActions>
              ) : null}
            </Message>
          );
        }

        if (message.role === "assistant") {
          const isLastMessage = messageIndex === messages.length - 1;
          const isStreaming =
            status === "streaming" && messages[messages.length - 1]?.id === message.id;
          const hasRenderableBody = assistantMessageHasRenderableBody({ message });
          const showAwaitingSkeleton = isLastMessage && isStreaming && !hasRenderableBody;

          return (
            <Message key={message.id} from="assistant">
              <MessageContent>
                {message.parts.map((part, i) => {
                  if (isRunnerAssistantStreamChromePart(part)) {
                    return null;
                  }
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
                    const toolName = getToolOrDynamicToolName(part);
                    // Memory and other headless tools: no inline card — outputs still live on the message for the Context sidebar.
                    if (!hasAssistantToolInlineUI({ toolName })) {
                      return null;
                    }
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
                {/* Placeholder while streamed body has not started — avoids a blank assistant row */}
                {showAwaitingSkeleton ? (
                  <AssistantAwaitingResponsePlaceholder key={`awaiting-${message.id}`} />
                ) : null}
              </MessageContent>
              {!isStreaming && canEditOrCopy && (
                <MessageActions
                  className={cn(
                    // Match user row: must stay interactive without hover (touch).
                    "text-muted-foreground opacity-80 transition-opacity hover:opacity-100"
                  )}
                >
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

      {status === "submitted" && messages.at(-1)?.role !== "assistant" ? (
        <Message from="assistant">
          <MessageContent>
            <AssistantAwaitingResponsePlaceholder key="awaiting-submitted" />
          </MessageContent>
        </Message>
      ) : null}
    </>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

/**
 * Prompt area: height follows content (not a tall empty panel). The textarea uses
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing | field-sizing}
 * to grow with text up to ~five lines, then scrolls.
 * The textarea stays enabled while a run is in flight so focus can return after send and users
 * can draft the next message; send remains gated until the run finishes.
 * When {@link pendingEditResend} is true, shows a banner so the user can cancel edit mode.
 */
function Composer({
  status,
  onStop,
  onSend,
  modelId,
  onModelChange,
  prompt,
  onPromptChange,
  pendingEditResend,
  onCancelPendingEditResend,
  textareaRef: textareaRefProp,
}: {
  status: ChatStatus;
  onStop: () => void;
  onSend: ({ text }: { text: string }) => void;
  modelId: string;
  onModelChange: ({ modelId }: { modelId: string }) => void;
  prompt: string;
  onPromptChange: ({ value }: { value: string }) => void;
  pendingEditResend: boolean;
  onCancelPendingEditResend: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const isActive = status === "streaming" || status === "submitted";
  const promptInputId = useId();
  const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = textareaRefProp ?? fallbackTextareaRef;

  const focusPrompt = useCallback(() => {
    textareaRef.current?.focus();
  }, [textareaRef]);

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
    if (e.key === "Escape" && pendingEditResend) {
      e.preventDefault();
      onCancelPendingEditResend();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isActive && prompt.trim()) {
        onSend({ text: prompt.trim() });
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isActive && prompt.trim()) {
      onSend({ text: prompt.trim() });
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
        {/* Edit-from-thread mode — explains truncation on send and offers cancel. */}
        {pendingEditResend ? (
          <InputGroupAddon
            align="block-start"
            className="border-b border-input bg-muted/50 px-3 py-2"
          >
            <div className="flex w-full min-w-0 items-start justify-between gap-2">
              <p
                className="min-w-0 text-left text-xs text-muted-foreground"
                aria-live="polite"
              >
                Editing an earlier message. Sending replaces that message and everything after
                it.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                onClick={onCancelPendingEditResend}
              >
                <XIcon className="size-3.5" aria-hidden />
                Clear
              </Button>
            </div>
          </InputGroupAddon>
        ) : null}
        <textarea
          ref={textareaRef}
          id={promptInputId}
          value={prompt}
          onChange={(e) => onPromptChange({ value: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Message Dailify…"
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
            <InputGroupButton type="submit" disabled={!prompt.trim()} size="xs">
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

/**
 * Assistant chat surface: message list, composer, and persistence hooks.
 * User messages can be edited from the thread; resending truncates history from that
 * message onward and continues with the new prompt text.
 */
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
    mergeStreamingMemoryContextFromChat,
    clearStreamingMemoryOverlay,
  } = useAssistantContext();

  const { modelId, setModelId } = useSelectedChatModel();

  const [promptInput, setPromptInput] = useState("");
  const [editTruncateFromIndex, setEditTruncateFromIndex] = useState<number | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * `useChat` keeps the first `transport` forever unless `id` changes. Resolved `body`
   * functions run at HTTP send (`resolve(body)`); refs stay current via the effect below.
   */
  const conversationIdRef = useRef(conversationId);
  const modelIdRef = useRef(modelId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
    modelIdRef.current = modelId;
  });

  /* eslint-disable react-hooks/refs -- body resolver runs only when the transport POSTs */
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId: conversationIdRef.current,
          modelId: modelIdRef.current,
        }),
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

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
    transport: chatTransport,
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
      if (part.type === "data-assistant-memory-context") {
        const data = part.data as { items?: unknown };
        const items = parseSidebarPreviewPayload(data?.items);
        mergeStreamingMemoryContextFromChat({ sessionKey: conversationId, items });
      }
    },
  });

  // Clear the live retrieval overlay when a new user turn starts so stale rows do not linger.
  useEffect(() => {
    if (status === "submitted") {
      clearStreamingMemoryOverlay();
    }
  }, [status, clearStreamingMemoryOverlay]);

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
      // Do not clear streaming memory here — finish metadata may apply to the assistant message
      // one tick after `ready`, and clearing early removed chips from the sidebar.
      const delayedSync = window.setTimeout(() => {
        void syncConversationFromRemoteDetail({ conversationId });
      }, 1200);
      return () => window.clearTimeout(delayedSync);
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
    queueMicrotask(() => {
      void sendMessage({ text: payload.text });
    });
  }, [takePendingForkSend, sendMessage]);

  const handlePromptChange = useCallback(({ value }: { value: string }) => {
    setPromptInput(value);
    setEditTruncateFromIndex((idx) => (idx !== null && value === "" ? null : idx));
  }, []);

  /**
   * Loads a user turn into the composer and arms truncation so the next send removes that
   * message and all following turns before posting again.
   */
  const beginEditUserMessage = useCallback(
    ({
      messageIndex,
      message,
    }: {
      messageIndex: number;
      message: UIMessage;
    }) => {
      setEditTruncateFromIndex(messageIndex);
      setPromptInput(getTextFromMessage(message));
      requestAnimationFrame(() => promptTextareaRef.current?.focus());
    },
    []
  );

  /** Leaves edit mode and clears the composer without changing the thread. */
  const cancelPendingEditResend = useCallback(() => {
    setEditTruncateFromIndex(null);
    setPromptInput("");
  }, []);

  /**
   * Sends the composer text; if editing an earlier turn, truncates the thread first so the
   * API only sees messages before that index, then appends the new user message.
   */
  const handleSend = useCallback(
    ({ text }: { text: string }) => {
      const truncateBeforeIndex = editTruncateFromIndex;
      setEditTruncateFromIndex(null);
      setPromptInput("");
      if (truncateBeforeIndex !== null) {
        flushSync(() => {
          setMessages((prev) => prev.slice(0, truncateBeforeIndex));
        });
      }
      void sendMessage({ text });
      // Composer stays enabled during a run so users can draft; move focus back after send.
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          promptTextareaRef.current?.focus();
        });
      });
    },
    [editTruncateFromIndex, sendMessage, setMessages]
  );

  const canEditOrCopy = status === "ready";
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
                canEditOrCopy={canEditOrCopy}
                onBeginEditUserMessage={beginEditUserMessage}
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
            prompt={promptInput}
            onPromptChange={handlePromptChange}
            pendingEditResend={editTruncateFromIndex !== null}
            onCancelPendingEditResend={cancelPendingEditResend}
            textareaRef={promptTextareaRef}
          />
        </div>
      </div>
    </div>
  );
}
