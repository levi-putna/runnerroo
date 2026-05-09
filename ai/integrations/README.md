# Integrations (future)

This folder is the **extension point** for third-party tools (email, CRM, ticketing, and so on). Today **`resolveIntegrationToolsForUser`** in `resolve-integration-tools.ts` returns an empty tool map so the rest of the assistant stack stays stable.

## Planned shape

1. **Connection record** per user (and optionally per workspace) — stores OAuth tokens or MCP endpoint configuration with RLS in Supabase.
2. **Tool builder** — async function `(supabase, userId) => { tools, brief }` merges provider-specific `tool()` definitions into the object passed to `streamText`.
3. **Permission modes** — see `types.ts`: `disabled`, `auto`, or `approval` per tool (mirrors user settings in the app).
4. **Prompt appendix** — `McpIntegrationsBrief.summaryLines` becomes a short “Connected integrations” section in `buildRunnerAssistantInstructions` so the model knows what is available.
5. **Tool UI** — each sensitive or verbose tool should register a `*-ui.tsx` in the same pattern as `ai/tools/tool-ui-registry.tsx` (today only core Dailify tools use that registry; integration UIs can be merged into the same map when you add them).

## Suggested implementation order

1. Define `types.ts` contracts for each provider’s catalog (tool names + Zod input schemas).
2. Implement `resolveIntegrationToolsForUser` to query enabled connections and `Object.assign` tool maps.
3. Add UI components for approval-heavy tools and register them next to core tools.

Until those steps exist, leave `resolve-integration-tools.ts` as a no-op stub.
