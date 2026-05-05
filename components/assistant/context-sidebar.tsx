"use client";

import { useState } from "react";

import { ContextMemoryDetailDialog } from "@/components/assistant/context-memory-detail-dialog";
import {
  useAssistantContext,
  type AssistantArtifact,
  type ContextArtefact,
} from "@/components/assistant/assistant-context";
import { ContextUsageSection } from "@/components/assistant/context-usage-section";
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

function ArtefactIcon({ item }: { item: ContextArtefact }) {
  if (item.type === "image" && item.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.previewUrl} alt="" className="size-full object-cover" />
    );
  }
  switch (item.type) {
    case "document": return <FileTextIcon className="size-4 text-muted-foreground" />;
    case "link": return <LinkIcon className="size-4 text-muted-foreground" />;
    default: return <PackageIcon className="size-4 text-muted-foreground" />;
  }
}

function ArtifactIcon({ type }: { type: AssistantArtifact["type"] }) {
  switch (type) {
    case "email": return <MailIcon className="size-4 text-muted-foreground" />;
    case "code": return <CodeIcon className="size-4 text-muted-foreground" />;
    case "summary": return <SparklesIcon className="size-4 text-muted-foreground" />;
    case "document": return <FileTextIcon className="size-4 text-muted-foreground" />;
    default: return <PackageIcon className="size-4 text-muted-foreground" />;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
      {children}
    </span>
  );
}

function InlineEmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground/50">
      {label}
    </p>
  );
}

type SectionId = "usage" | "context" | "artifacts" | "memory";

function SectionHeader({
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
      className="mb-1.5 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={() => onOpenChange(!open)}
    >
      <SectionLabel>{label}</SectionLabel>
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

export function ContextSidebar() {
  const {
    artefacts,
    removeArtefact,
    artifacts,
    removeArtifact,
    openArtifactFullscreen,
    conversationHistory,
    conversationKey,
    applyMemoryRemovalAfterDelete,
  } = useAssistantContext();

  const [focusedMemoryId, setFocusedMemoryId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    usage: true,
    context: true,
    artifacts: true,
    memory: true,
  });

  const setSectionOpen = (sectionId: SectionId, nextOpen: boolean) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: nextOpen }));
  };

  const activeMemoryPreview =
    conversationHistory.find((row) => row.id === conversationKey)?.memoriesPreview ?? [];

  const hasArtefacts = artefacts.length > 0;
  const hasArtifacts = artifacts.length > 0;

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col" aria-label="Context and memory">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 pr-1">

          {/* ── Usage ─────────────────────────────────────────────────────── */}
          <ContextUsageSection
            open={openSections.usage}
            onOpenChange={(nextOpen) => setSectionOpen("usage", nextOpen)}
          />

          {/* ── Context (drag-and-drop artefacts) ─────────────────────────── */}
          <section aria-label="Context items" className="flex flex-col">
            <SectionHeader
              label="Context"
              open={openSections.context}
              controlsId="context-section-body"
              onOpenChange={(nextOpen) => setSectionOpen("context", nextOpen)}
            />
            {openSections.context && (
              <div id="context-section-body" className="flex flex-col gap-1">
                {!hasArtefacts ? (
                  <InlineEmptyState label="Drop files or links here to add context" />
                ) : (
                  artefacts.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded">
                        <ArtefactIcon item={item} />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {item.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-5 shrink-0 opacity-60 hover:opacity-100"
                        onClick={() => removeArtefact({ id: item.id })}
                        aria-label={`Remove ${item.title}`}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* ── Artifacts (AI outputs) ────────────────────────────────────── */}
          <section aria-label="Artifacts" className="flex flex-col">
            <SectionHeader
              label="Artifacts"
              open={openSections.artifacts}
              controlsId="artifacts-section-body"
              onOpenChange={(nextOpen) => setSectionOpen("artifacts", nextOpen)}
            />
            {openSections.artifacts && (
              <div id="artifacts-section-body" className="flex flex-col gap-1">
                {!hasArtifacts ? (
                  <InlineEmptyState label="No artifacts yet" />
                ) : (
                  artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="group flex items-center gap-2 rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center">
                        <ArtifactIcon type={artifact.type} />
                      </div>
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-foreground hover:text-foreground/80"
                        onClick={() => openArtifactFullscreen({ artifact })}
                      >
                        {artifact.title}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-5 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100"
                        onClick={() => removeArtifact({ id: artifact.id })}
                        aria-label={`Remove ${artifact.title}`}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* ── Memory (chips from conversation) ─────────────────────────── */}
          <section aria-label="Memory" className="flex flex-col">
            <SectionHeader
              label="Memory"
              open={openSections.memory}
              controlsId="memory-section-body"
              onOpenChange={(nextOpen) => setSectionOpen("memory", nextOpen)}
            />
            {openSections.memory && (
              <div id="memory-section-body" className="flex flex-col gap-1">
                {activeMemoryPreview.length === 0 ? (
                  <InlineEmptyState label="No memories surfaced yet" />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeMemoryPreview.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFocusedMemoryId(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                        title={item.preview}
                      >
                        <BrainIcon className="size-3 shrink-0" aria-hidden />
                        <span className="truncate max-w-[120px]">{item.key ?? item.preview}</span>
                        {item.isNew && (
                          <span className="ml-0.5 size-1.5 rounded-full bg-emerald-500 shrink-0" aria-label="new" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      {/* Memory detail dialog */}
      <ContextMemoryDetailDialog
        memoryId={focusedMemoryId}
        open={focusedMemoryId !== null}
        onOpenChange={(open) => {
          if (!open) setFocusedMemoryId(null);
        }}
        onDeleted={({ memoryId }) => {
          setFocusedMemoryId(null);
          applyMemoryRemovalAfterDelete({ memoryId });
        }}
      />
    </aside>
  );
}
