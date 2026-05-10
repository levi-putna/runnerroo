# Agents (`ai/agents/`)

Server-only modules. They must not import React or client-only APIs.

## Modules

| File | Purpose |
|------|---------|
| `chat-agent.ts` | **`runAssistantChatTurn`** — consumes `runAssistantMemoryRetrieval` output, optionally runs planning, loads tools, calls `streamText` with multi-step `stopWhen`. Used by `app/api/chat/route.ts`. |
| `memory-retrieval-agent.ts` | **`runAssistantMemoryRetrieval`** — hybrid keyword + embedding retrieval before the main model. Optional rerank when `MEMORY_RETRIEVAL_RERANKER=true`. |
| `planning-agent.ts` | **`runPlanningAgent`** — short `generateObject` pass to pick a markdown skill. **Disabled by default**; set `RUNNER_ASSISTANT_PLANNING=true` to enable (adds latency and token cost). |
| `memory-review-agent.ts` | **`runMemoryReviewAgent`** — proposes memory CRUD actions after a turn; applied server-side via `lib/memories/apply-memory-review-actions.ts` (see chat route `after()` hook). |

## Environment

- `RUNNER_ASSISTANT_PLANNING` — set to `"true"` to run the planning pass each chat turn.
- `PLANNING_MODEL` — optional override for the planning model (falls back to `NEXT_PUBLIC_ASSISTANT_MODEL` or a sensible default).
- `MEMORY_RETRIEVAL_RERANKER` — set to `"true"` to run an extra small-model rerank over hybrid retrieval candidates.
- `MEMORY_RETRIEVAL_RERANK_MODEL` — optional model id for that rerank pass.
