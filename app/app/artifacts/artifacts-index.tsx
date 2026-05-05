"use client"

import * as React from "react"
import { Download, FileArchive, FileText } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ArtifactListItem } from "@/app/app/artifacts/page"

type ArtifactFilter = "all" | "documents" | "templates"

export interface ArtifactsIndexProps {
  artifacts: ArtifactListItem[]
}

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
 * Artefacts table with simple category filtering and secure downloads.
 */
export function ArtifactsIndex({ artifacts }: ArtifactsIndexProps) {
  const [filter, setFilter] = React.useState<ArtifactFilter>("all")
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  const filteredArtifacts = React.useMemo(() => {
    if (filter === "all") return artifacts
    if (filter === "documents") {
      return artifacts.filter((row) => row.category === "document_output")
    }
    return artifacts.filter((row) => row.category === "document_template")
  }, [artifacts, filter])

  /**
   * Fetches an on-demand signed URL for the selected file and opens it in a new tab.
   */
  async function handleDownload({
    fileId,
  }: {
    fileId: string
  }) {
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
    <div className="flex flex-col bg-background">
      {/* Header section */}
      <PageHeader
        title="Artefacts"
        description="Browse generated documents and workflow templates stored in secure blob storage."
      >
        <Badge variant="outline">{artifacts.length} files</Badge>
      </PageHeader>

      <div className="flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Filter tabs */}
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as ArtifactFilter)}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Artefacts table / empty state */}
          {filteredArtifacts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
              <FileArchive className="mx-auto mb-3 size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                No artefacts found for this filter yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
              <Table>
                <TableHeader className="border-b border-border/70 bg-muted/40 dark:bg-muted/25">
                  <TableRow className="border-0 hover:bg-transparent [&:hover]:bg-transparent">
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[120px] text-right">Size</TableHead>
                    <TableHead className="hidden w-[140px] md:table-cell">Category</TableHead>
                    <TableHead className="hidden w-[200px] lg:table-cell">Created</TableHead>
                    <TableHead className="w-[120px] pr-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArtifacts.map((artifact) => (
                    <TableRow key={artifact.id}>
                      {/* Name */}
                      <TableCell className="pl-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-[13px] font-medium">{artifact.name}</span>
                        </div>
                      </TableCell>
                      {/* Type */}
                      <TableCell>
                        <Badge variant="outline" className="font-normal lowercase">
                          {mimeBadgeLabel({ mimeType: artifact.mime_type })}
                        </Badge>
                      </TableCell>
                      {/* Size */}
                      <TableCell className="text-right text-[13px] tabular-nums text-muted-foreground">
                        {formatFileSize({ bytes: artifact.size_bytes })}
                      </TableCell>
                      {/* Category */}
                      <TableCell className="hidden md:table-cell">
                        <span className="text-[12px] text-muted-foreground">{artifact.category}</span>
                      </TableCell>
                      {/* Created */}
                      <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                        {new Date(artifact.created_at).toLocaleString()}
                      </TableCell>
                      {/* Action */}
                      <TableCell className="pr-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={downloadingId === artifact.id}
                          onClick={() => void handleDownload({ fileId: artifact.id })}
                        >
                          <Download className="mr-1 size-3.5" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
