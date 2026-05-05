# Assistant tools (`ai/tools/`)

## Adding a tool (checklist)

1. **Define** the tool with `tool({ ... })` from the `ai` package (typically under `utility/`, `geo-map/`, `memories/`, or `example/`).
2. **Register** it in `index.ts` (`createAssistantTools`) under a **camelCase** key — that key is the tool name the model sees.
3. **Add UI** in a colocated `*-ui.tsx` file (for tools that surface in chat) and map the same key in `tool-ui-registry.tsx`.
4. **Client-only completion** (no server `execute`): omit `execute`, render choices in the UI, then call `addToolOutput` from `useChat`. Wire `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` so the assistant continues after the user answers.

## Environment

| Variable | Used by |
|----------|---------|
| `TAVILY_API_KEY` | `webSearch`, `tavilyExtract`, `tavilyCrawl` (server only — never `NEXT_PUBLIC_`). |

If `TAVILY_API_KEY` is unset, Tavily tools still register but will error when invoked.

## Current pack

- **webSearch**, **tavilyExtract**, **tavilyCrawl** — Tavily (`@tavily/ai-sdk`).
- **askQuestion** — client-completed multiple choice.
- **generateRandomNumber** — demo of `needsApproval` (`example/`).
- **showLocation** — OpenStreetMap Nominatim geocoding (no API key).
- **searchUserMemories** — Supabase/pgvector-backed memory search.
