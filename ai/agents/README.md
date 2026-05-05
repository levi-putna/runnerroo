# Agents (`ai/agents/`)

Server-only modules. They must not import React or client-only APIs.

## Modules

| File | Purpose |
|------|---------|
| `chat-agent.ts` | **`runAssistantChatTurn`** — builds memory context, optionally runs planning, loads tools, calls `streamText` with multi-step `stopWhen`. Used by `app/api/chat/route.ts`. |
| `planning-agent.ts` | **`runPlanningAgent`** — short `generateObject` pass to pick a markdown skill. **Disabled by default**; set `RUNNER_ASSISTANT_PLANNING=true` to enable (adds latency and token cost). |
| `memory-review-agent.ts` | **`runMemoryReviewAgent`** — proposes memory CRUD actions from a conversation. **Not wired** to HTTP yet; reserved for a background job or post-turn hook. |

## Environment

- `RUNNER_ASSISTANT_PLANNING` — set to `"true"` to run the planning pass each chat turn.
- `PLANNING_MODEL` — optional override for the planning model (falls back to `NEXT_PUBLIC_ASSISTANT_MODEL` or a sensible default).
