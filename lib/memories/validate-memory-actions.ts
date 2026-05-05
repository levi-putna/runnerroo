import { MEMORY_TYPES, type MemoryRecord, type MemoryReviewAction } from "@/lib/memories/types";

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bpassword\b/i,
  /\bapi[_-\s]?key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bprivate[_-\s]?key\b/i,
  /\bsk-[a-z0-9]{16,}\b/i,
];

export function toMemoryKeySlug({ value }: { value: string }): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function isExplicitRememberRequest({ userMessageText }: { userMessageText: string }): boolean {
  const message = userMessageText.toLowerCase();
  return (
    message.includes("remember this") ||
    message.includes("please remember") ||
    message.includes("save this memory") ||
    message.includes("don't forget")
  );
}

function looksSensitive({ content }: { content: string }): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(content));
}

function isDuplicateContent({
  content,
  activeMemories,
}: {
  content: string;
  activeMemories: MemoryRecord[];
}): boolean {
  const normalisedCandidate = content.trim().toLowerCase();
  if (!normalisedCandidate) return true;
  return activeMemories.some(
    (memory) => memory.content.trim().toLowerCase() === normalisedCandidate,
  );
}

export type MemoryValidationDropped = {
  reason: string;
  action: MemoryReviewAction;
};

export function validateMemoryActions({
  actions,
  userMessageText,
  activeMemories,
}: {
  actions: MemoryReviewAction[];
  userMessageText: string;
  activeMemories: MemoryRecord[];
}): { validated: MemoryReviewAction[]; dropped: MemoryValidationDropped[] } {
  const isExplicit = isExplicitRememberRequest({ userMessageText });
  const validated: MemoryReviewAction[] = [];
  const dropped: MemoryValidationDropped[] = [];

  for (const candidate of actions) {
    if (candidate.action === "NOOP") {
      validated.push(candidate);
      continue;
    }

    if (candidate.action === "SAVE" || candidate.action === "UPDATE") {
      const content = candidate.content?.trim() ?? "";
      if (!content) {
        dropped.push({ reason: "empty_content_after_trim", action: candidate });
        continue;
      }
      if (!isExplicit && candidate.confidence < 0.7) {
        dropped.push({ reason: `confidence_below_0_p7 (${candidate.confidence})`, action: candidate });
        continue;
      }
      if (!isExplicit && candidate.importance < 0.6) {
        dropped.push({ reason: `importance_below_0_p6 (${candidate.importance})`, action: candidate });
        continue;
      }
      if (!isExplicit && looksSensitive({ content })) {
        dropped.push({ reason: "blocked_sensitive_patterns", action: candidate });
        continue;
      }
      if (candidate.action === "SAVE" && isDuplicateContent({ content, activeMemories })) {
        dropped.push({ reason: "duplicate_exact_active_memory_content", action: candidate });
        continue;
      }
      const type = candidate.type;
      if (!type || !MEMORY_TYPES.includes(type)) {
        dropped.push({ reason: type ? `invalid_memory_type (${type})` : "missing_memory_type", action: candidate });
        continue;
      }
      const sourceKey = candidate.key?.trim() || content.slice(0, 64);
      const stableKey = toMemoryKeySlug({ value: sourceKey });
      if (!stableKey || !/^[a-z][a-z0-9_]*$/.test(stableKey)) {
        dropped.push({ reason: `invalid_key_slug (${JSON.stringify(stableKey)})`, action: candidate });
        continue;
      }
      validated.push({
        ...candidate,
        key: stableKey,
        content,
        type,
        importance: Math.min(1, Math.max(0, candidate.importance)),
        confidence: Math.min(1, Math.max(0, candidate.confidence)),
      });
      continue;
    }

    if (candidate.action === "ARCHIVE" || candidate.action === "DELETE") {
      if (!candidate.memoryId) {
        dropped.push({ reason: "missing_memory_id_for_archive_or_delete", action: candidate });
        continue;
      }
      validated.push(candidate);
      continue;
    }

    dropped.push({ reason: "unhandled_action_variant", action: candidate });
  }

  return { validated, dropped };
}
