# AI layer (`ai/`)

This directory holds **server-side orchestration** (agents), **static skills** (markdown + small TS fragments), **assistant tools**, and a **stub** for future third-party integrations. UI for tools lives next to definitions under `ai/tools/**` and is wired through `tool-ui-registry.tsx` into `components/assistant/runner-chat.tsx`.

## Layout

| Path | Role |
|------|------|
| `agents/` | `streamText` orchestration, planning pass, memory review helpers (no React). |
| `skills/` | Repo-authored guidance; markdown skills are picked by the optional planning agent. |
| `tools/` | Tool definitions (`tool()`), factories, and matching `*-ui.tsx` components. |
| `integrations/` | Placeholder merge point for OAuth/MCP tools when you add them. |

Workflow graph execution under `lib/workflow/` is intentionally separate from this assistant stack.
