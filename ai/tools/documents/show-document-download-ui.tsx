"use client";

import { AlertTriangle, Download } from "lucide-react";
import type {
  DynamicToolUIPart,
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  UIMessage,
} from "ai";

import { Skeleton } from "@/components/ui/skeleton";
import { badgeAndLabelForFile, filenameFromUrl } from "@/ai/tools/documents/document-download-helpers";
import { cn } from "@/lib/utils";

type ShowDocumentDownloadInput = {
  url?: string;
  fileName?: string;
  fileLabel?: string;
  sizeDisplay?: string;
};

type ShowDocumentDownloadOutput = {
  url: string;
  fileName?: string;
  fileLabel?: string;
  sizeDisplay?: string;
};

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Icon badge: rounded square, blue fill, dog-ear corner, extension label (matches assistant doc previews).
 */
function DocumentDownloadIconBadge({ badge }: { badge: string }) {
  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#2563eb]",
        "shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      )}
      aria-hidden
    >
      {/* Dog-ear */}
      <div
        className="pointer-events-none absolute right-0 top-0 size-3 rounded-bl-md bg-[#1d4ed8]"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
      />
      <span className="relative z-[1] max-w-[2.75rem] truncate text-[10px] font-bold uppercase leading-none text-white">
        {badge}
      </span>
    </div>
  );
}

function DocumentDownloadRowSkeleton() {
  return (
    <div className="flex w-full min-w-0 items-center gap-4 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[min(100%,14rem)]" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="hidden h-4 w-14 sm:block" />
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>
  );
}

/**
 * Single-row downloadable file preview for the `showDocumentDownload` tool.
 */
function DocumentDownloadRow({
  url,
  displayName,
  subtitle,
  sizeDisplay,
  badge,
}: {
  url: string;
  displayName: string;
  subtitle: string;
  sizeDisplay?: string;
  badge: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-4 rounded-xl border border-border bg-background px-4 py-3 shadow-sm sm:flex-nowrap">
      {/* Leading icon */}
      <DocumentDownloadIconBadge badge={badge} />

      {/* Title + type */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-foreground">{displayName}</div>
        <div className="truncate text-sm text-muted-foreground">{subtitle}</div>
      </div>

      {/* Size */}
      <div className="hidden min-w-[4.5rem] text-sm text-muted-foreground sm:block">
        {sizeDisplay !== undefined && sizeDisplay.trim().length > 0 ? sizeDisplay.trim() : "\u00a0"}
      </div>

      {/* Download */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-sm font-semibold text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Download
      </a>
    </div>
  );
}

/**
 * Tool UI for `showDocumentDownload` — horizontal file row with icon, metadata, and download link.
 */
export function ShowDocumentDownloadUI({ part }: Props) {
  // ─── Loading: tool args streaming or awaiting execution ─────────────────

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <DocumentDownloadRowSkeleton />;
  }

  // ─── Success ───────────────────────────────────────────────────────────

  if (part.state === "output-available") {
    const out = part.output as ShowDocumentDownloadOutput;
    const url = out.url;
    const resolvedName =
      out.fileName !== undefined && out.fileName.trim().length > 0
        ? out.fileName.trim()
        : filenameFromUrl({ url });
    const { badge, label } = badgeAndLabelForFile({
      fileName: resolvedName,
      url,
      fileLabel: out.fileLabel,
    });

    return (
      <DocumentDownloadRow
        url={url}
        displayName={resolvedName}
        subtitle={label}
        sizeDisplay={out.sizeDisplay}
        badge={badge}
      />
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────

  if (part.state === "output-error") {
    const input = (part.input ?? {}) as ShowDocumentDownloadInput;
    const url = typeof input.url === "string" ? input.url : "";
    const nameGuess =
      typeof input.fileName === "string" && input.fileName.trim().length > 0
        ? input.fileName.trim()
        : url
          ? filenameFromUrl({ url })
          : "Document";

    return (
      <div className="flex w-full items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <Download size={14} className="shrink-0 opacity-80" aria-hidden />
            <span>Could not prepare download</span>
          </div>
          <p className="text-muted-foreground">{part.errorText ?? "Something went wrong."}</p>
          {url.length > 0 ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-[#2563eb] hover:underline"
            >
              Try opening link: {nameGuess}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
