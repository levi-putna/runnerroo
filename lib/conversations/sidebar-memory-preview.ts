import { type UIMessage, getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from "ai";

export type SidebarMemoryPreviewItem = {
  id: string;
  type: string;
  key?: string;
  preview: string;
  isNew?: boolean;
};

export const SEARCH_USER_MEMORIES_TOOL_NAME = "searchUserMemories";

/** Tool name key for upserting a memory from the assistant. */
export const UPSERT_USER_MEMORY_TOOL_NAME = "upsertUserMemory";

type AssistantMemoryMetadata = {
  memoriesRetrieved?: Array<{ id: string; type: string; key?: string; preview: string }>;
  memoriesNewlyCreated?: Array<{ id: string; type: string; key?: string; preview: string }>;
};

export function toSidebarPreviewSnippet({ text }: { text: string }): string {
  const compact = text.trim().replace(/\s+/g, " ");
  return compact.length > 120 ? `${compact.slice(0, 119)}…` : compact;
}

/**
 * Maps retrieval rows from the chat API into sidebar preview chips (stable ids, trimmed preview text).
 */
export function memoryRetrievedRowsToSidebarPreviewItems({
  rows,
}: {
  rows: Array<{ id: string; type: string; key: string; preview: string }>;
}): SidebarMemoryPreviewItem[] {
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    key: row.key,
    preview: toSidebarPreviewSnippet({ text: row.preview }),
    isNew: false,
  }));
}

function unwrapPossibleToolJsonEnvelope(output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  const candidate = output as Record<string, unknown>;
  if (Array.isArray(candidate.memories)) return candidate;
  if ("value" in candidate && candidate.value && typeof candidate.value === "object") return candidate.value;
  if ("json" in candidate && candidate.json && typeof candidate.json === "object") return candidate.json;
  return candidate;
}

function sidebarItemsFromSearchUserMemoriesExecuteOutput(output: unknown): SidebarMemoryPreviewItem[] {
  const resolved = unwrapPossibleToolJsonEnvelope(output);
  if (!resolved || typeof resolved !== "object") return [];
  const object = resolved as Record<string, unknown>;
  const rawList = object.memories;
  if (!Array.isArray(rawList)) return [];

  const items: SidebarMemoryPreviewItem[] = [];
  for (const entry of rawList) {
    if (!entry || typeof entry !== "object") continue;
    const memory = entry as Record<string, unknown>;
    const id = typeof memory.id === "string" ? memory.id : "";
    const type = typeof memory.type === "string" ? memory.type : "";
    const rawContent = memory.content;
    const previewText =
      typeof rawContent === "string" ? rawContent
      : rawContent !== undefined && rawContent !== null ? String(rawContent)
      : "";
    const keyRaw = memory.key;

    if (!id || !type || previewText.trim().length === 0) continue;

    items.push({
      id,
      type,
      key: typeof keyRaw === "string" ? keyRaw : undefined,
      preview: toSidebarPreviewSnippet({ text: previewText }),
      isNew: false,
    });
  }

  return items;
}

function sidebarItemsFromUpsertUserMemoryOutput(output: unknown): SidebarMemoryPreviewItem[] {
  const resolved = unwrapPossibleToolJsonEnvelope(output);
  if (!resolved || typeof resolved !== "object") return [];
  const object = resolved as Record<string, unknown>;
  const id = typeof object.id === "string" ? object.id : "";
  const type = typeof object.type === "string" ? object.type : "";
  const rawContent = object.content;
  const content =
    typeof rawContent === "string"
      ? rawContent
      : rawContent !== undefined && rawContent !== null
        ? String(rawContent)
        : "";
  const keyRaw = object.key;
  if (!id || !type || content.trim().length === 0) return [];

  return [
    {
      id,
      type,
      key: typeof keyRaw === "string" ? keyRaw : undefined,
      preview: toSidebarPreviewSnippet({ text: content }),
      isNew: true,
    },
  ];
}

export function collectSidebarMemoryPreviewItemsFromAssistantMessage(
  message: UIMessage,
): SidebarMemoryPreviewItem[] {
  const buckets: SidebarMemoryPreviewItem[][] = [];
  const metadata = message.metadata as AssistantMemoryMetadata | undefined;
  const fromStreaming: SidebarMemoryPreviewItem[] = [];

  if (metadata && Array.isArray(metadata.memoriesRetrieved)) {
    for (const row of metadata.memoriesRetrieved) {
      if (!row?.id || !row?.type || typeof row.preview !== "string") continue;
      fromStreaming.push({
        id: row.id,
        type: row.type,
        key: row.key,
        preview: toSidebarPreviewSnippet({ text: row.preview }),
        isNew: false,
      });
    }
  }

  if (metadata && Array.isArray(metadata.memoriesNewlyCreated)) {
    for (const row of metadata.memoriesNewlyCreated) {
      if (!row?.id || !row?.type || typeof row.preview !== "string") continue;
      fromStreaming.push({
        id: row.id,
        type: row.type,
        key: row.key,
        preview: toSidebarPreviewSnippet({ text: row.preview }),
        isNew: true,
      });
    }
  }

  if (fromStreaming.length > 0) buckets.push(fromStreaming);

  const fromMemoryTools: SidebarMemoryPreviewItem[] = [];
  for (const part of message.parts) {
    if (!isToolOrDynamicToolUIPart(part)) continue;
    if (part.state !== "output-available") continue;
    const toolName = getToolOrDynamicToolName(part);
    if (toolName === SEARCH_USER_MEMORIES_TOOL_NAME) {
      fromMemoryTools.push(...sidebarItemsFromSearchUserMemoriesExecuteOutput(part.output));
      continue;
    }
    if (toolName === UPSERT_USER_MEMORY_TOOL_NAME) {
      fromMemoryTools.push(...sidebarItemsFromUpsertUserMemoryOutput(part.output));
    }
  }

  if (fromMemoryTools.length > 0) buckets.push(fromMemoryTools);

  let merged: SidebarMemoryPreviewItem[] = [];
  for (const batch of buckets) {
    merged = mergeSidebarMemoryPreviewRows(merged, batch);
  }

  return merged.slice(0, 12);
}

export function deriveSidebarMemoryPreviewFromMessages(messages: UIMessage[]): SidebarMemoryPreviewItem[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return collectSidebarMemoryPreviewItemsFromAssistantMessage(message);
    }
  }
  return [];
}

export function parseSidebarPreviewPayload(payload: unknown): SidebarMemoryPreviewItem[] {
  if (!Array.isArray(payload)) return [];

  const items: SidebarMemoryPreviewItem[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const object = entry as Record<string, unknown>;
    const id = typeof object.id === "string" ? object.id : "";
    const type = typeof object.type === "string" ? object.type : "";
    const preview = typeof object.preview === "string" ? object.preview : "";
    const key = typeof object.key === "string" ? object.key : undefined;
    const isNew = typeof object.isNew === "boolean" ? object.isNew : undefined;
    if (!id || !type) continue;
    items.push({ id, type, key, preview, ...(typeof isNew === "boolean" ? { isNew } : {}) });
  }

  return items;
}

export function mergeSidebarMemoryPreviewRows(
  existing: SidebarMemoryPreviewItem[],
  incoming: SidebarMemoryPreviewItem[],
): SidebarMemoryPreviewItem[] {
  const map = new Map<string, SidebarMemoryPreviewItem>();

  for (const item of existing) {
    map.set(item.id, { ...item });
  }

  for (const item of incoming) {
    const prior = map.get(item.id);
    if (!prior) {
      map.set(item.id, { ...item });
      continue;
    }
    map.set(item.id, { ...prior, ...item, isNew: Boolean(prior.isNew) || Boolean(item.isNew) });
  }

  return [...map.values()].slice(0, 12);
}

export function hydrateSidebarPreviewWithRemoteMerge({
  derivedFromMessages,
  fromDb,
}: {
  derivedFromMessages: SidebarMemoryPreviewItem[];
  fromDb: SidebarMemoryPreviewItem[];
}): SidebarMemoryPreviewItem[] {
  if (derivedFromMessages.length > 0) {
    return mergeSidebarMemoryPreviewRows(fromDb, derivedFromMessages);
  }
  return mergeSidebarMemoryPreviewRows(fromDb.filter(({ isNew }) => Boolean(isNew)), []);
}
