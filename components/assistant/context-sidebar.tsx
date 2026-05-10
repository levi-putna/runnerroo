"use client";

import Link from "next/link";
import { useState } from "react";

import { ContextMemoryDetailDialog } from "@/components/assistant/context-memory-detail-dialog";
import {
  useAssistantContext,
  type AssistantArtifact,
  type ContextArtefact,
} from "@/components/assistant/assistant-context";
import { mergeSidebarMemoryPreviewRows } from "@/lib/conversations/sidebar-memory-preview";
import { ContextUsageSection } from "@/components/assistant/context-usage-section";
import { ProgressTracker } from "@/components/tool-ui/progress-tracker";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BrainIcon,
  ChevronDownIcon,
  CodeIcon,
  FileTextIcon,
  LinkIcon,
  MailIcon,
  PackageIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the icon for a given artefact type.
 * For images with a preview URL, a thumbnail is rendered instead.
 */
function ArtefactIcon({ item }: { item: ContextArtefact }) {
  if (item.type === "image" && item.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob preview URLs
      <img src={item.previewUrl} alt="" className="size-full object-cover" />
    );
  }

  switch (item.type) {
    case "document":
      return <FileTextIcon className="size-4 text-muted-foreground" />;
    case "link":
      return <LinkIcon className="size-4 text-muted-foreground" />;
    default:
      return <PackageIcon className="size-4 text-muted-foreground" />;
  }
}

/**
 * Returns the icon for a given AI-generated artifact type.
 */
function ArtifactIcon({ type }: { type: AssistantArtifact["type"] }) {
  switch (type) {
    case "email":
      return <MailIcon className="size-4 text-muted-foreground" />;
    case "code":
      return <CodeIcon className="size-4 text-muted-foreground" />;
    case "summary":
      return <SparklesIcon className="size-4 text-muted-foreground" />;
    case "skill":
      return <SparklesIcon className="size-4 text-muted-foreground" />;
    case "document":
      return <FileTextIcon className="size-4 text-muted-foreground" />;
    default:
      return <PackageIcon className="size-4 text-muted-foreground" />;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Minimal single-line empty state for sections with no content yet. */
function InlineEmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground/50">
      {label}
    </p>
  );
}

type ContextSidebarSectionId =
  | "usage"
  | "entities"
  | "artifacts"
  | "memory"
  | "knowledge"
  | "plan";

/**
 * Collapse toggle heading for compact sidebar sections (Usage-style label + chevron).
 */
function ContextSidebarSectionHeader({
  label,
  open,
  controlsId,
  onOpenChange,
}: {
  label: string;
  open: boolean;
  controlsId: string;
  onOpenChange: (nextOpen: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="mb-1.5 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={() => onOpenChange(!open)}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-foreground">
        {label}
      </span>
      <ChevronDownIcon
        className={`size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
        aria-hidden
      />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Context & Memory panel beside the conversation.
 * Groups session usage plus attachable context into sections aligned with Strata Console.
 */
export function ContextSidebar() {
  const {
    artefacts,
    removeArtefact,
    artifacts,
    removeArtifact,
    plan,
    openArtifactFullscreen,
    openInboxMessageViewer,
    conversationHistory,
    conversationKey,
    applyMemoryRemovalAfterDelete,
    streamingMemoryOverlay,
  } = useAssistantContext();

  const [focusedMemoryId, setFocusedMemoryId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<ContextSidebarSectionId, boolean>>({
    usage: true,
    entities: true,
    artifacts: true,
    memory: true,
    knowledge: true,
    plan: true,
  });

  /**
   * Updates the expanded/collapsed state for a given section.
   */
  const setSectionOpen = (sectionId: ContextSidebarSectionId, nextOpen: boolean) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: nextOpen }));
  };

  /** Preview rows for whichever thread the chat is showing (defaults to []). */
  const persistedMemoryPreview =
    conversationHistory.find((row) => row.id === conversationKey)?.memoriesPreview ?? [];

  const liveMemoryItems =
    streamingMemoryOverlay?.sessionKey === conversationKey
      ? streamingMemoryOverlay.items
      : [];

  const activeMemoryPreview = mergeSidebarMemoryPreviewRows(persistedMemoryPreview, liveMemoryItems);

  const hasEntities = artefacts.length > 0;
  const hasArtifacts = artifacts.length > 0;

  return (
    <aside
      className="flex h-full min-h-0 w-full min-w-0 flex-col"
      aria-label="Context and memory"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 pr-1">
          {/* ── Usage (tokens & cost) ───────────────────────────────────── */}
          <ContextUsageSection
            open={openSections.usage}
            onOpenChange={(nextOpen) => setSectionOpen("usage", nextOpen)}
          />

          {/* ── Entities ──────────────────────────────────────────────── */}
          <section aria-label="Attached entities">
            <ContextSidebarSectionHeader
              label="Entities"
              open={openSections.entities}
              controlsId="context-sidebar-section-entities"
              onOpenChange={(nextOpen) => setSectionOpen("entities", nextOpen)}
            />

            <div
              id="context-sidebar-section-entities"
              role="region"
              hidden={!openSections.entities}
            >
              {hasEntities ? (
                <div className="flex flex-col gap-1" role="list">
                  {artefacts.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-stretch gap-2 rounded-lg p-1.5 hover:bg-accent"
                      role="listitem"
                    >
                      {item.inboxEntity && openInboxMessageViewer ? (
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => openInboxMessageViewer({ item: item.inboxEntity! })}
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                            <MailIcon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1 py-0.5">
                            <p className="truncate text-sm font-medium leading-snug text-foreground">
                              {item.title}
                            </p>
                            {item.description ? (
                              <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                            ) : null}
                          </div>
                        </button>
                      ) : (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-3 px-0.5 py-0.5">
                            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                              <ArtefactIcon item={item} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium leading-snug text-foreground">
                                {item.title}
                              </p>
                              {item.description ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 shrink-0 self-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => removeArtefact({ id: item.id })}
                        aria-label={`Remove ${item.title} from context`}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <InlineEmptyState label="Drop documents or images to attach them to your next message" />
              )}
            </div>
          </section>

          {/* ── Artifacts ─────────────────────────────────────────────── */}
          <section>
            <ContextSidebarSectionHeader
              label="Artifacts"
              open={openSections.artifacts}
              controlsId="context-sidebar-section-artifacts"
              onOpenChange={(nextOpen) => setSectionOpen("artifacts", nextOpen)}
            />

            <div
              id="context-sidebar-section-artifacts"
              role="region"
              hidden={!openSections.artifacts}
            >
              {hasArtifacts ? (
                <div className="flex flex-col gap-1" role="list">
                  {artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="group flex items-center gap-1 rounded-lg p-2 hover:bg-accent"
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() => openArtifactFullscreen({ artifact })}
                        aria-label={`Open ${artifact.title} in full screen`}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                          <ArtifactIcon type={artifact.type} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-snug text-foreground">
                            {artifact.title}
                          </p>
                          <p className="truncate text-xs capitalize text-muted-foreground">
                            {artifact.type}
                          </p>
                        </div>
                      </button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeArtifact({ id: artifact.id });
                        }}
                        aria-label={`Remove ${artifact.title}`}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <InlineEmptyState label="No artifacts generated yet" />
              )}
            </div>
          </section>

          {/* ── Memory ─────────────────────────────────────────────────── */}
          <section>
            <ContextSidebarSectionHeader
              label="Memory"
              open={openSections.memory}
              controlsId="context-sidebar-section-memory"
              onOpenChange={(nextOpen) => setSectionOpen("memory", nextOpen)}
            />

            <div
              id="context-sidebar-section-memory"
              role="region"
              hidden={!openSections.memory}
            >
              {activeMemoryPreview.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    {activeMemoryPreview.slice(0, 8).map((memory) => (
                      <button
                        key={memory.id}
                        type="button"
                        title={
                          memory.key?.trim()
                            ? `${memory.type} · ${memory.key}: ${memory.preview ?? ""}`
                            : `${memory.type}: ${memory.preview ?? ""}`
                        }
                        onClick={() => {
                          setFocusedMemoryId(memory.id);
                        }}
                        className="group flex w-full max-w-full cursor-pointer items-start gap-2 rounded-md border border-border/40 bg-background px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-muted/40"
                      >
                        {/* Memory icon (left) */}
                        <BrainIcon
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/55 group-hover:text-muted-foreground"
                          aria-hidden
                        />
                        {/* Memory text */}
                        <span className="line-clamp-2 min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground/90">
                          {memory.preview?.trim() ? memory.preview : "—"}
                        </span>
                        {/* New badge (right — compact label, icon-like weight) */}
                        {memory.isNew ? (
                          <span
                            className="mt-[3px] shrink-0 text-[9px] font-semibold leading-none tracking-wide text-blue-600 dark:text-blue-400"
                            title="New this turn"
                          >
                            NEW
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/app/settings/memories"
                    className="text-[11px] text-muted-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Open saved memories in Settings
                  </Link>
                </div>
              ) : (
                <InlineEmptyState label="No memory hits surfaced in the latest reply yet — open History for saved threads." />
              )}
            </div>
          </section>

          {/* ── Knowledge ─────────────────────────────────────────────── */}
          <section>
            <ContextSidebarSectionHeader
              label="Knowledge"
              open={openSections.knowledge}
              controlsId="context-sidebar-section-knowledge"
              onOpenChange={(nextOpen) => setSectionOpen("knowledge", nextOpen)}
            />

            <div
              id="context-sidebar-section-knowledge"
              role="region"
              hidden={!openSections.knowledge}
            >
              <InlineEmptyState label="No knowledge sources active" />
            </div>
          </section>

          {/* ── Plan ──────────────────────────────────────────────────── */}
          <section>
            <ContextSidebarSectionHeader
              label="Plan"
              open={openSections.plan}
              controlsId="context-sidebar-section-plan"
              onOpenChange={(nextOpen) => setSectionOpen("plan", nextOpen)}
            />

            <div
              id="context-sidebar-section-plan"
              role="region"
              hidden={!openSections.plan}
            >
              {plan ? (
                <ProgressTracker
                  id={plan.id}
                  steps={plan.steps}
                  elapsedTime={plan.elapsedTime}
                />
              ) : (
                <InlineEmptyState label="No active plan" />
              )}
            </div>
          </section>
        </div>
      </ScrollArea>

      <ContextMemoryDetailDialog
        key={focusedMemoryId ?? "closed"}
        memoryId={focusedMemoryId}
        open={focusedMemoryId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setFocusedMemoryId(null);
          }
        }}
        onDeleted={({ memoryId }) => {
          applyMemoryRemovalAfterDelete({ memoryId });
        }}
      />
    </aside>
  );
}
