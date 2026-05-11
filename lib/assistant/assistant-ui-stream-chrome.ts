/**
 * Stable stream part ids so the AI SDK merges UI data chunks into a single in-message part
 * instead of appending one invisible part per chunk (which caused duplicate-looking rows and
 * missed heading updates when `useChat` `onData` lagged behind `messages` updates).
 */
export const RUNNER_UI_STREAM_PART_IDS = {
  memoryContext: "runner-assistant-memory-context",
  conversationTitle: "runner-conversation-title",
} as const;

/** UI-only data part types written by {@link app/api/chat/route.ts} before the model stream. */
export const RUNNER_ASSISTANT_STREAM_CHROME_TYPES = [
  "data-assistant-memory-context",
  "data-conversation-title",
  /** Legacy stream chunks from earlier server builds — strip from render if present. */
  "data-assistant-awaiting-heading",
] as const;

/**
 * Whether a UI message part is assistant stream chrome (sidebar / placeholder), not thread body.
 */
export function isRunnerAssistantStreamChromePart(part: { type: string }): boolean {
  return (RUNNER_ASSISTANT_STREAM_CHROME_TYPES as readonly string[]).includes(part.type);
}
