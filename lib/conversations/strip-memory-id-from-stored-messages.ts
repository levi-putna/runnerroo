import {
  type UIMessage,
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart,
} from "ai";

import { SEARCH_USER_MEMORIES_TOOL_NAME } from "@/lib/conversations/sidebar-memory-preview";

function deepStripMatchingIdsFromNestedMemories({ node, memoryId }: { node: unknown; memoryId: string }): void {
  if (node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) {
      deepStripMatchingIdsFromNestedMemories({ node: item, memoryId });
    }
    return;
  }

  const object = node as Record<string, unknown>;
  if (Array.isArray(object.memories)) {
    object.memories = object.memories.filter((entry) => {
      if (!entry || typeof entry !== "object") return true;
      return (entry as { id?: string }).id !== memoryId;
    });
  }

  for (const key of Object.keys(object)) {
    deepStripMatchingIdsFromNestedMemories({ node: object[key], memoryId });
  }
}

function stripMemoryIdFromSearchToolStructuredOutput({ output, memoryId }: { output: unknown; memoryId: string }): unknown {
  let cloned: unknown;
  try {
    cloned = structuredClone(output);
  } catch {
    try {
      cloned = JSON.parse(JSON.stringify(output));
    } catch {
      return output;
    }
  }
  deepStripMatchingIdsFromNestedMemories({ node: cloned, memoryId });
  return cloned;
}

export function stripMemoryIdFromUIMessages({
  messages,
  memoryId,
}: {
  messages: UIMessage[];
  memoryId: string;
}): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    const metadataUnknown = message.metadata;
    let nextMeta: Record<string, unknown> | undefined;

    if (metadataUnknown && typeof metadataUnknown === "object") {
      const patched = { ...(metadataUnknown as Record<string, unknown>) };
      let mutated = false;

      if (Array.isArray(patched.memoriesRetrieved)) {
        const previous = patched.memoriesRetrieved as Array<{ id?: string }>;
        const filtered = previous.filter((row) => row?.id !== memoryId);
        if (filtered.length !== previous.length) { mutated = true; patched.memoriesRetrieved = filtered; }
      }
      if (Array.isArray(patched.memoriesNewlyCreated)) {
        const previous = patched.memoriesNewlyCreated as Array<{ id?: string }>;
        const filtered = previous.filter((row) => row?.id !== memoryId);
        if (filtered.length !== previous.length) { mutated = true; patched.memoriesNewlyCreated = filtered; }
      }
      if (mutated) nextMeta = patched;
    }

    let partsChanged = false;
    const nextParts = message.parts.map((part) => {
      if (!isToolOrDynamicToolUIPart(part) || part.state !== "output-available") return part;
      if (getToolOrDynamicToolName(part) !== SEARCH_USER_MEMORIES_TOOL_NAME) return part;
      const nextOutput = stripMemoryIdFromSearchToolStructuredOutput({ output: part.output, memoryId });
      if (nextOutput === part.output) return part;
      partsChanged = true;
      return { ...part, output: nextOutput };
    });

    const metaApplied = Boolean(nextMeta);
    if (!metaApplied && !partsChanged) return message;

    return {
      ...message,
      ...(metaApplied ? { metadata: nextMeta as typeof message.metadata } : {}),
      ...(partsChanged ? { parts: nextParts } : {}),
    } as UIMessage;
  });
}
