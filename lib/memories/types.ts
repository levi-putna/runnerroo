export const MEMORY_TYPES = [
  "preference",
  "profile",
  "project",
  "task",
  "temporary",
  "behaviour",
  "technical_context",
] as const;

export const MEMORY_STATUSES = ["active", "archived", "deleted"] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export type MemoryRecord = {
  id: string;
  user_id: string;
  type: MemoryType;
  key: string;
  content: string;
  importance: number;
  confidence: number;
  source: string | null;
  source_message_id: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  status: MemoryStatus;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryHybridMatch = MemoryRecord & {
  similarity_score: number;
  keyword_score: number;
  combined_score: number;
};

export type MemoryReviewAction = {
  action: "SAVE" | "UPDATE" | "ARCHIVE" | "DELETE" | "NOOP";
  memoryId: string | null;
  type: MemoryType | null;
  key: string | null;
  content: string | null;
  importance: number;
  confidence: number;
  expiresAt: string | null;
  reason: string;
};
