"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Download,
  FileArchive,
  FileText,
  SearchIcon,
} from "lucide-react"

import type { ArtifactListItem } from "@/app/app/artifacts/page"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Compact filter triggers (matches Usage / Workflows toolbar pills). */
const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** Maximum artefact rows per table page. */
const ARTIFACTS_PAGE_SIZE = 50

type ArtifactCategoryFilter = "all" | "document_output" | "document_template" | "other"

const CATEGORY_FILTER_OPTIONS: {
  value: ArtifactCategoryFilter
  menuLabel: string
  triggerLabel: string
}[] = [
  { value: "all", menuLabel: "All categories", triggerLabel: "All categories" },
  { value: "document_output", menuLabel: "Documents", triggerLabel: "Documents" },
  { value: "document_template", menuLabel: "Templates", triggerLabel: "Templates" },
  { value: "other", menuLabel: "Other", triggerLabel: "Other" },
]

/**
 * Human-readable file size formatting for artefact lists.
 */
function formatFileSize({ bytes }: { bytes: number | null }): string {
  if (bytes === null || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Short mime label for chip rendering.
 */
function mimeBadgeLabel({ mimeType }: { mimeType: string | null }): string {
  if (!mimeType) return "file"
  if (mimeType.includes("wordprocessingml")) return "docx"
  if (mimeType.includes("msword")) return "doc"
  if (mimeType.includes("pdf")) return "pdf"
  return mimeType.split("/")[1] ?? mimeType
}

/**
 * Label shown on the category filter control.
 */
function categoryFilterTriggerLabel({
  categoryFilter,
}: {
  categoryFilter: ArtifactCategoryFilter
}): string {
  return (
    CATEGORY_FILTER_OPTIONS.find((opt) => opt.value === categoryFilter)?.triggerLabel ??
    "All categories"
  )
}

export interface ArtifactsIndexProps {
  artifacts: ArtifactListItem[]
  /** Extra classes on the outer wrapper (matches workflows / usage pages). */
  className?: string
}

/**
 * Artefacts hub: filters, overview tiles, bordered table, and pagination aligned with Workflows index.
 */
export function ArtifactsIndex({ artifacts, className }: ArtifactsIndexProps) {
  const [nameSearch, setNameSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<ArtifactCategoryFilter>("all")
  const [categoryPickerOpen, setCategoryPickerOpen] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  const resetPagination = React.useCallback(() => {
    setPage(1)
  }, [])

  const filteredArtifacts = React.useMemo(() => {
    const query = nameSearch.trim().toLowerCase()
    return artifacts.filter((row) => {
      if (query.length > 0 && !row.name.toLowerCase().includes(query)) {
        return false
      }
      if (categoryFilter !== "all" && row.category !== categoryFilter) {
        return false
      }
      return true
    })
  }, [artifacts, nameSearch, categoryFilter])

  const totalFiltered = filteredArtifacts.length
  const maxPage = Math.max(1, Math.ceil(totalFiltered / ARTIFACTS_PAGE_SIZE))
  const effectivePage = Math.min(Math.max(1, page), maxPage)
  const pageSliceStart = (effectivePage - 1) * ARTIFACTS_PAGE_SIZE
  const paginatedArtifacts = filteredArtifacts.slice(
    pageSliceStart,
    pageSliceStart + ARTIFACTS_PAGE_SIZE,
  )

  const pageRangeLabel = React.useMemo(() => {
    if (totalFiltered === 0) {
      return "No rows"
    }
    const startIdx = pageSliceStart + 1
    const endIdx = Math.min(pageSliceStart + ARTIFACTS_PAGE_SIZE, totalFiltered)
    return `${startIdx}–${endIdx} of ${totalFiltered}`
  }, [totalFiltered, pageSliceStart])

  const documentCount = filteredArtifacts.filter((r) => r.category === "document_output").length
  const templateCount = filteredArtifacts.filter((r) => r.category === "document_template").length
  const otherCount = filteredArtifacts.filter((r) => r.category === "other").length

  const hasNonDefaultFilters =
    nameSearch.trim().length > 0 || categoryFilter !== "all"

  const categoryScopeBadge = categoryFilter === "all" ? "3/3" : "1/3"

  /**
   * Fetches an on-demand signed URL for the selected file and opens it in a new tab.
   */
  async function handleDownload({ fileId }: { fileId: string }) {
    setDownloadingId(fileId)
    try {
      const response = await fetch(`/api/artifacts/${fileId}/signed-url`)
      const json = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !json.url) {
        window.alert(json.error ?? "Could not create download URL")
        return
      }
      window.open(json.url, "_blank", "noopener,noreferrer")
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", className)}>
      {/* ── Page title (fixed header row) ── */}
      <PageHeader
        title="Artefacts"
        description="Browse generated documents and workflow templates stored in secure blob storage."
      />

      <div className="flex flex-col gap-6 p-6">
        {/* ── Filter toolbar ── */}
        <div className="flex min-w-0 flex-col gap-2 pb-0.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div
            className={cn(
              FILTER_TRIGGER_CLASS,
              "min-h-9 w-full min-w-0 max-w-md flex-1 justify-start gap-2 py-0 pl-2 pr-2 lg:max-w-md",
            )}
          >
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              value={nameSearch}
              onChange={(event) => {
                setNameSearch(event.target.value)
                resetPagination()
              }}
              placeholder="Search by file name…"
              className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search artefacts by file name"
            />
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 overflow-x-auto lg:justify-end">
            <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={FILTER_TRIGGER_CLASS}>
                  <span className="flex items-center gap-0.5" aria-hidden>
                    <span className="size-1.5 rounded-full bg-sky-500" />
                    <span className="size-1.5 rounded-full bg-violet-500" />
                    <span className="size-1.5 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-muted-foreground">Category</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {categoryScopeBadge}
                  </span>
                  <span className="max-w-[12rem] truncate font-medium text-foreground">
                    {categoryFilterTriggerLabel({ categoryFilter })}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[18rem] p-0">
                <Command>
                  <CommandInput placeholder="Search categories…" />
                  <CommandList>
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup>
                      {CATEGORY_FILTER_OPTIONS.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.value}
                          keywords={[opt.menuLabel, opt.triggerLabel]}
                          onSelect={() => {
                            setCategoryFilter(opt.value)
                            resetPagination()
                            setCategoryPickerOpen(false)
                          }}
                        >
                          {opt.menuLabel}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── Overview (filtered set) ── */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">Overview</p>
          <p className="text-xs text-muted-foreground">
            Summary counts include every artefact that matches your filters (not only the current page).
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total files
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{totalFiltered}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-sky-600 dark:text-sky-400">
                {documentCount}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Templates</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-violet-600 dark:text-violet-400">
                {templateCount}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Other</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{otherCount}</p>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                        <FileArchive className="size-6 text-muted-foreground/50" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No artefacts yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Generated documents and templates will appear here after workflows create them.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredArtifacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">No artefacts match your filters</p>
                    <p className="mt-1 text-sm">
                      Try clearing search or setting category to All categories.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedArtifacts.map((artifact) => (
                  <tr
                    key={artifact.id}
                    className="border-b border-border/80 last:border-0 transition-colors hover:bg-muted/30"
                  >
                    {/* Name */}
                    <td className="max-w-[18rem] px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate font-medium">{artifact.name}</span>
                      </div>
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-normal lowercase">
                        {mimeBadgeLabel({ mimeType: artifact.mime_type })}
                      </Badge>
                    </td>
                    {/* Size */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatFileSize({ bytes: artifact.size_bytes })}
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3 text-muted-foreground">{artifact.category}</td>
                    {/* Created */}
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {new Date(artifact.created_at).toLocaleString("en-AU")}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={downloadingId === artifact.id}
                        onClick={() => void handleDownload({ fileId: artifact.id })}
                      >
                        <Download className="size-3.5" aria-hidden />
                        Download
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer: counts + pagination ── */}
        {artifacts.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Rows are ordered by created date (newest first).
              {hasNonDefaultFilters ? (
                <>
                  {" "}
                  <span className="tabular-nums">
                    {totalFiltered} matching file{totalFiltered === 1 ? "" : "s"}
                  </span>{" "}
                  from <span className="tabular-nums">{artifacts.length}</span> loaded.
                </>
              ) : null}
            </p>

            {totalFiltered > 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{pageRangeLabel}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={effectivePage <= 1}
                    onClick={() => setPage(effectivePage - 1)}
                  >
                    <ChevronLeftIcon className="size-4" aria-hidden />
                    Previous
                  </Button>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    Page {effectivePage} / {maxPage}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={effectivePage >= maxPage}
                    onClick={() => setPage(effectivePage + 1)}
                  >
                    Next
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
