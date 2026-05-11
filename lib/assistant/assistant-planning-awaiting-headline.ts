/**
 * Status lines rotated on the client while the assistant placeholder is visible (before streamed
 * text or tools appear). The server does not stream these during planning.
 */
export const ASSISTANT_PLANNING_AWAITING_HEADLINES = [
  "Planning a response…",
  "Reasoning through this…",
  "Analysing your request…",
  "Processing your message…",
  "Considering your options…",
  "Reviewing the context...",
] as const;
