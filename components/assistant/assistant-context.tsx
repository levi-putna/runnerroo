"use client";

import type { ConversationUsageAggregate } from "@/lib/assistant/aggregate-conversation-usage";
import type { ActivePlan } from "@/components/tool-ui/progress-tracker";
import {
  deriveSidebarMemoryPreviewFromMessages,
  hydrateSidebarPreviewWithRemoteMerge,
  mergeSidebarMemoryPreviewRows,
  parseSidebarPreviewPayload,
} from "@/lib/conversations/sidebar-memory-preview";
import { stripMemoryIdFromUIMessages } from "@/lib/conversations/strip-memory-id-from-stored-messages";
import type { FileUIPart, UIMessage } from "ai";
import { nanoid } from "nanoid";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal inbox payload when an entity row should open a fullscreen reader. */
export type ContextInboxEntity = {
  id: string;
  title: string;
};

export type ContextArtefact = {
  id: string;
  title: string;
  type: "document" | "image" | "link" | "resource";
  description?: string;
  file?: File;
  previewUrl?: string;
  /** When set, this row may open a fullscreen reader from Entities (if {@link AssistantContextValue.openInboxMessageViewer} is configured). */
  inboxEntity?: ContextInboxEntity;
};

export type AssistantArtifactWordDocument = {
  base64: string;
  fileName: string;
  mimeType: string;
};

export type AssistantArtifact = {
  id: string;
  title: string;
  type: "document" | "email" | "code" | "summary" | "skill" | "other";
  content: string;
  createdAt: string;
  wordDocument?: AssistantArtifactWordDocument;
};

export type ConversationRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  memoriesPreview: Array<{
    id: string;
    type: string;
    key?: string;
    preview: string;
    isNew?: boolean;
  }>;
  messages: UIMessage[];
};

// ─── API helpers ──────────────────────────────────────────────────────────────

type ConversationListRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  memories_preview?: Array<{
    id: string;
    type: string;
    key?: string;
    preview: string;
    isNew?: boolean;
  }>;
};

type ConversationDetailRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  memories_preview?: Array<{
    id: string;
    type: string;
    key?: string;
    preview: string;
    isNew?: boolean;
  }>;
  messages: UIMessage[];
};

function areUIMessageArraysEqual(a: UIMessage[], b: UIMessage[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sortConversationHistoryByUpdatedAt(
  records: ConversationRecord[]
): ConversationRecord[] {
  return [...records].sort((left, right) => {
    const delta =
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    if (delta !== 0) return delta;
    return left.id.localeCompare(right.id);
  });
}

function rowToRecord(row: ConversationListRow, messages: UIMessage[] = []): ConversationRecord {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memoriesPreview: row.memories_preview ?? [],
    messages,
  };
}

// ─── Context shape ────────────────────────────────────────────────────────────

type AssistantContextValue = {
  artifacts: AssistantArtifact[];
  addArtifact: (artifact: AssistantArtifact) => void;
  removeArtifact: ({ id }: { id: string }) => void;
  artefacts: ContextArtefact[];
  setArtefacts: (
    next: ContextArtefact[] | ((previous: ContextArtefact[]) => ContextArtefact[])
  ) => void;
  addArtefacts: (items: ContextArtefact[]) => void;
  addArtefactsFromFiles: ({ files }: { files: File[] }) => void;
  removeArtefact: ({ id }: { id: string }) => void;
  clearFileArtefacts: () => void;
  conversationKey: string;
  /** The conversation ID to reflect in the URL — null means a brand-new unsaved conversation. */
  activeConversationId: string | null;
  /**
   * The title for the currently active conversation. New threads use "New conversation"
   * until an AI-generated title arrives or a persisted title is loaded.
   * null only briefly while loading a deep-linked conversation by ID.
   */
  activeConversationTitle: string | null;
  /** Updates the title for a conversation — called when the title arrives from the chat stream. */
  setConversationTitle: ({ id, title }: { id: string; title: string }) => void;
  startNewConversation: () => void;
  activeConversationMessages: UIMessage[] | null;
  conversationHistory: ConversationRecord[];
  saveConversation: (id: string, messages: UIMessage[]) => void;
  flushSave: (id: string) => void;
  syncConversationFromRemoteDetail: ({ conversationId }: { conversationId: string }) => void;
  loadConversation: (id: string) => void;
  forkConversationContinue: ({
    initialMessages,
    queuedSend,
  }: {
    initialMessages: UIMessage[];
    queuedSend: { text: string; files?: FileUIPart[] };
  }) => void;
  takePendingForkSend: () => { text: string; files?: FileUIPart[] } | null;
  artifactFullscreen: AssistantArtifact | null;
  openArtifactFullscreen: ({ artifact }: { artifact: AssistantArtifact }) => void;
  closeArtifactFullscreen: () => void;
  /** Optional plan surfaced in the Context sidebar (e.g. multi-step agent work). */
  plan: ActivePlan | null;
  setPlan: ({ plan }: { plan: ActivePlan | null }) => void;
  /** Optional handler when an entity row represents an inbox message. */
  openInboxMessageViewer?: ({ item }: { item: ContextInboxEntity }) => void;
  conversationUsageAggregate: ConversationUsageAggregate | null;
  setConversationUsageAggregate: ({
    aggregate,
  }: {
    aggregate: ConversationUsageAggregate | null;
  }) => void;
  stripTargetMemoryIdRef: MutableRefObject<string | null>;
  chatMemoryStripNonce: number;
  applyMemoryRemovalAfterDelete: ({ memoryId }: { memoryId: string }) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistantContext(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error("useAssistantContext must be used within AssistantContextProvider");
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 800;

export function AssistantContextProvider({
  children,
  initialConversationId,
}: {
  children: React.ReactNode;
  initialConversationId?: string;
}) {
  // ── Artefacts (drag-and-drop context items) ────────────────────────────────
  const [artefacts, setArtefacts] = useState<ContextArtefact[]>([]);

  const addArtefacts = useCallback((items: ContextArtefact[]) => {
    setArtefacts((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const incoming = items.filter((i) => !existingIds.has(i.id));
      return [...prev, ...incoming];
    });
  }, []);

  const addArtefactsFromFiles = useCallback(({ files }: { files: File[] }) => {
    const next: ContextArtefact[] = files.map((file) => ({
      id: nanoid(),
      title: file.name,
      type: file.type.startsWith("image/") ? "image" : "document",
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    addArtefacts(next);
  }, [addArtefacts]);

  const removeArtefact = useCallback(({ id }: { id: string }) => {
    setArtefacts((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearFileArtefacts = useCallback(() => {
    setArtefacts((prev) => {
      for (const a of prev) {
        if (a.file && a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      return prev.filter((a) => !a.file);
    });
  }, []);

  // ── Artifacts (AI-generated outputs) ──────────────────────────────────────
  const [artifacts, setArtifacts] = useState<AssistantArtifact[]>([]);
  const addArtifact = useCallback((artifact: AssistantArtifact) => {
    setArtifacts((prev) => {
      const idx = prev.findIndex((a) => a.id === artifact.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = artifact;
        return next;
      }
      return [artifact, ...prev];
    });
  }, []);
  const removeArtifact = useCallback(({ id }: { id: string }) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Artifact fullscreen ────────────────────────────────────────────────────
  const [artifactFullscreen, setArtifactFullscreen] = useState<AssistantArtifact | null>(null);
  const openArtifactFullscreen = useCallback(({ artifact }: { artifact: AssistantArtifact }) => {
    setArtifactFullscreen(artifact);
  }, []);
  const closeArtifactFullscreen = useCallback(() => setArtifactFullscreen(null), []);

  // ── Agent plan (Context sidebar) ───────────────────────────────────────────
  const [plan, setPlanState] = useState<ActivePlan | null>(null);
  const setPlan = useCallback(({ plan: nextPlan }: { plan: ActivePlan | null }) => {
    setPlanState(nextPlan);
  }, []);

  // ── Usage aggregate ────────────────────────────────────────────────────────
  const [conversationUsageAggregate, setConversationUsageAggregateState] =
    useState<ConversationUsageAggregate | null>(null);
  const setConversationUsageAggregate = useCallback(
    ({ aggregate }: { aggregate: ConversationUsageAggregate | null }) => {
      setConversationUsageAggregateState(aggregate);
    },
    []
  );

  // ── Memory strip ───────────────────────────────────────────────────────────
  const stripTargetMemoryIdRef = useRef<string | null>(null);
  const [chatMemoryStripNonce, setChatMemoryStripNonce] = useState(0);

  // ── Conversation key (remount signal) ─────────────────────────────────────
  // Always starts as a fresh nanoid — even for URL deep-links.
  // The initial-load effect swaps it to initialConversationId once messages are fetched,
  // triggering a RunnerChat remount with the correct initial messages already in place.
  const [conversationKey, setConversationKey] = useState<string>(() => nanoid());

  // The conversation ID that should be reflected in the URL.
  // null = brand-new conversation (no messages saved yet).
  // string = conversation ID (persisted or being persisted).
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId ?? null
  );

  // The AI-generated (or server-persisted) title for the active conversation.
  // Brand-new chat (no URL id) shows "New conversation"; null only while a deep-linked id loads.
  const [activeConversationTitle, setActiveConversationTitle] = useState<string | null>(() =>
    initialConversationId ? null : "New conversation"
  );

  // Tracks AI-generated titles keyed by conversation ID so they can be included
  // in subsequent PUT saves without an additional fetch.
  const conversationTitleMapRef = useRef<Record<string, string>>({});

  const [activeConversationMessages, setActiveConversationMessages] =
    useState<UIMessage[] | null>(null);

  // ── Conversation history ───────────────────────────────────────────────────
  const [conversationHistory, setConversationHistory] = useState<ConversationRecord[]>([]);

  // Load history on mount
  useEffect(() => {
    void fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((rows: ConversationListRow[] | null) => {
        if (!rows) return;
        setConversationHistory(
          sortConversationHistoryByUpdatedAt(rows.map((r) => rowToRecord(r)))
        );
      })
      .catch(() => {});
  }, []);

  // Load the initial conversation when navigating directly to /app/chat/[id].
  // Sets activeConversationMessages THEN flips conversationKey to the real ID so
  // RunnerChat remounts with the fetched messages already available via useChat's
  // initial-messages prop.
  useEffect(() => {
    if (!initialConversationId) return;
    void fetch(`/api/conversations/${initialConversationId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((row: ConversationDetailRow | null) => {
        if (!row) return;
        const messages = row.messages ?? [];
        setActiveConversationMessages(messages);
        // Flip conversationKey to trigger RunnerChat remount with loaded messages
        setConversationKey(initialConversationId);
        // Surface the persisted title in the header immediately
        setActiveConversationTitle(row.title?.trim() || "New conversation");
        setConversationHistory((prev) => {
          const exists = prev.some((r) => r.id === row.id);
          if (exists) return prev;
          return sortConversationHistoryByUpdatedAt([rowToRecord(row, messages), ...prev]);
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally runs once on mount — initialConversationId is stable

  // ── Pending fork send ──────────────────────────────────────────────────────
  const pendingForkSendRef = useRef<{ text: string; files?: FileUIPart[] } | null>(null);

  const takePendingForkSend = useCallback((): { text: string; files?: FileUIPart[] } | null => {
    const payload = pendingForkSendRef.current;
    pendingForkSendRef.current = null;
    return payload;
  }, []);

  // ── Debounced save ─────────────────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ id: string; messages: UIMessage[] } | null>(null);

  const flushSave = useCallback((id: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending || pending.id !== id) return;
    pendingSaveRef.current = null;

    // Include any AI-generated title so it overrides the server's first-message fallback.
    const title = conversationTitleMapRef.current[id];
    void fetch(`/api/conversations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: pending.messages, ...(title ? { title } : {}) }),
    }).catch(() => {});
  }, []);

  const saveConversation = useCallback(
    (id: string, messages: UIMessage[]) => {
      // Expose the conversation ID for URL sync as soon as the first message is present
      if (messages.length > 0) {
        setActiveConversationId(id);
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingSaveRef.current = { id, messages };

      // Optimistically update local history chip, preserving any AI-generated title.
      setConversationHistory((prev) => {
        const existing = prev.find((r) => r.id === id);
        const derived = deriveSidebarMemoryPreviewFromMessages(messages);
        const knownTitle = conversationTitleMapRef.current[id];
        if (existing) {
          return sortConversationHistoryByUpdatedAt(
            prev.map((r) =>
              r.id === id
                ? {
                    ...r,
                    updatedAt: new Date().toISOString(),
                    // Apply the AI title if it arrived before this save tick.
                    ...(knownTitle ? { title: knownTitle } : {}),
                    memoriesPreview: mergeSidebarMemoryPreviewRows(r.memoriesPreview, derived),
                    messages: areUIMessageArraysEqual(r.messages, messages) ? r.messages : messages,
                  }
                : r
            )
          );
        }
        return sortConversationHistoryByUpdatedAt([
          {
            id,
            title: knownTitle ?? "New conversation",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            memoriesPreview: derived,
            messages,
          },
          ...prev,
        ]);
      });

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const payload = pendingSaveRef.current;
        if (!payload || payload.id !== id) return;
        pendingSaveRef.current = null;

        const title = conversationTitleMapRef.current[id];
        void fetch(`/api/conversations/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload.messages, ...(title ? { title } : {}) }),
        }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    []
  );

  /**
   * Stores a generated title for the given conversation and updates local state immediately
   * so the header reflects it before the next server sync.
   */
  const setConversationTitle = useCallback(({ id, title }: { id: string; title: string }) => {
    conversationTitleMapRef.current[id] = title;
    setActiveConversationTitle(title);
    setConversationHistory((prev) => {
      const exists = prev.some((r) => r.id === id);
      if (exists) {
        return sortConversationHistoryByUpdatedAt(
          prev.map((r) => (r.id === id ? { ...r, title } : r))
        );
      }
      // Entry not yet in history — it will be added on the next saveConversation tick.
      return prev;
    });
  }, []);

  // Ref that always holds the latest activeConversationId value, used inside
  // syncConversationFromRemoteDetail to avoid stale closures.
  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const syncConversationFromRemoteDetail = useCallback(
    ({ conversationId }: { conversationId: string }) => {
      void fetch(`/api/conversations/${conversationId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((row: ConversationDetailRow | null) => {
          if (!row) return;
          const fromDb = parseSidebarPreviewPayload(row.memories_preview ?? []);
          setConversationHistory((prev) => {
            const existing = prev.find((r) => r.id === conversationId);
            const derivedFromMessages = deriveSidebarMemoryPreviewFromMessages(
              existing?.messages ?? row.messages ?? []
            );
            const merged = hydrateSidebarPreviewWithRemoteMerge({
              derivedFromMessages,
              fromDb,
            });

            // Prefer AI-generated title stored locally over what the server returns
            // (the server may not have persisted it yet on a first-turn sync).
            const resolvedTitle =
              conversationTitleMapRef.current[conversationId] || row.title;

            const updated: ConversationRecord = {
              id: row.id,
              title: resolvedTitle,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              memoriesPreview: merged,
              messages: existing?.messages ?? row.messages ?? [],
            };

            // Sync active conversation title to the header if this is the current thread.
            if (activeConversationIdRef.current === conversationId) {
              setActiveConversationTitle(resolvedTitle?.trim() || "New conversation");
            }

            if (existing) {
              return sortConversationHistoryByUpdatedAt(
                prev.map((r) => (r.id === conversationId ? updated : r))
              );
            }
            return sortConversationHistoryByUpdatedAt([updated, ...prev]);
          });
        })
        .catch(() => {});
    },
    []
  );

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveConversationTitle("New conversation");
    setActiveConversationMessages(null);
    setArtefacts([]);
    setArtifacts([]);
    setPlanState(null);
    setConversationUsageAggregateState(null);
    setConversationKey(nanoid());
  }, []);

  const loadConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      const record = conversationHistory.find((r) => r.id === id);
      if (record && record.messages.length > 0) {
        setActiveConversationMessages(record.messages);
        setConversationKey(id);
        setArtefacts([]);
        setArtifacts([]);
        setPlanState(null);
        setConversationUsageAggregateState(null);
        // Set title from the history record so the header updates immediately.
        const recordTitle = conversationTitleMapRef.current[id] || record.title;
        setActiveConversationTitle(recordTitle?.trim() || "New conversation");
        return;
      }

      void fetch(`/api/conversations/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((row: ConversationDetailRow | null) => {
          if (!row) return;
          setActiveConversationMessages(row.messages ?? []);
          setConversationKey(id);
          setArtefacts([]);
          setArtifacts([]);
          setPlanState(null);
          setConversationUsageAggregateState(null);
          const rowTitle = conversationTitleMapRef.current[id] || row.title;
          setActiveConversationTitle(rowTitle?.trim() || "New conversation");
        })
        .catch(() => {});
    },
    [conversationHistory]
  );

  const forkConversationContinue = useCallback(
    ({
      initialMessages,
      queuedSend,
    }: {
      initialMessages: UIMessage[];
      queuedSend: { text: string; files?: FileUIPart[] };
    }) => {
      pendingForkSendRef.current = queuedSend;
      setActiveConversationMessages(initialMessages);
      setConversationKey(nanoid());
    },
    []
  );

  const applyMemoryRemovalAfterDelete = useCallback(
    ({ memoryId }: { memoryId: string }) => {
      setConversationHistory((prev) =>
        prev.map((record) => ({
          ...record,
          memoriesPreview: record.memoriesPreview.filter((m) => m.id !== memoryId),
          messages: stripMemoryIdFromUIMessages({ messages: record.messages, memoryId }),
        }))
      );
      stripTargetMemoryIdRef.current = memoryId;
      setChatMemoryStripNonce((n) => n + 1);
    },
    []
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      artifacts,
      addArtifact,
      removeArtifact,
      artefacts,
      setArtefacts,
      addArtefacts,
      addArtefactsFromFiles,
      removeArtefact,
      clearFileArtefacts,
      conversationKey,
      activeConversationId,
      activeConversationTitle,
      setConversationTitle,
      startNewConversation,
      activeConversationMessages,
      conversationHistory,
      saveConversation,
      flushSave,
      syncConversationFromRemoteDetail,
      loadConversation,
      forkConversationContinue,
      takePendingForkSend,
      artifactFullscreen,
      openArtifactFullscreen,
      closeArtifactFullscreen,
      plan,
      setPlan,
      openInboxMessageViewer: undefined,
      conversationUsageAggregate,
      setConversationUsageAggregate,
      stripTargetMemoryIdRef,
      chatMemoryStripNonce,
      applyMemoryRemovalAfterDelete,
    }),
    [
      artifacts,
      addArtifact,
      removeArtifact,
      artefacts,
      addArtefacts,
      addArtefactsFromFiles,
      removeArtefact,
      clearFileArtefacts,
      conversationKey,
      activeConversationId,
      activeConversationTitle,
      setConversationTitle,
      startNewConversation,
      activeConversationMessages,
      conversationHistory,
      saveConversation,
      flushSave,
      syncConversationFromRemoteDetail,
      loadConversation,
      forkConversationContinue,
      takePendingForkSend,
      artifactFullscreen,
      openArtifactFullscreen,
      closeArtifactFullscreen,
      plan,
      setPlan,
      conversationUsageAggregate,
      setConversationUsageAggregate,
      chatMemoryStripNonce,
      applyMemoryRemovalAfterDelete,
    ]
  );

  return (
    <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
  );
}
