"use client"

import * as React from "react"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { WORKFLOW_DOCUMENT_TEMPLATES_BUCKET } from "@/lib/workflows/storage/workflow-document-buckets"
import { cn } from "@/lib/utils"

export interface DocumentTemplateUploadFieldProps {
  workflowId?: string | null
  /** React Flow step id posted with the multipart form. */
  nodeId: string
  /** Persisted workflow_document_templates.id when configured. */
  templateFileId: string
  /** Display name echoed from metadata (optional until first upload completes). */
  templateFileName: string
  onTemplateRegistered: ({
    templateFileId,
    templateFileName,
  }: {
    templateFileId: string
    templateFileName: string
  }) => void
  onTemplateRemoved: () => void
}

/**
 * Drag-and-drop (or picker) UI for uploading a Word template into the isolated templates bucket.
 */
export function DocumentTemplateUploadField({
  workflowId,
  nodeId,
  templateFileId,
  templateFileName,
  onTemplateRegistered,
  onTemplateRemoved,
}: DocumentTemplateUploadFieldProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const hasTemplate = templateFileId.trim() !== ""

  const canUpload = workflowId != null && workflowId !== ""
  const blockingReason =
    workflowId === "new" || workflowId === undefined || workflowId === ""
      ? "Save your workflow before uploading a template. Templates are stored per workflow."
      : null

  /**
   * POSTs multipart data to persist the template metadata and blob in Supabase Storage.
   */
  async function uploadSelectedFile({
    file,
  }: {
    file: File
  }) {
    if (!canUpload || !workflowId) return
    setError(null)
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.set("nodeId", nodeId)
      fd.set("file", file)
      const res = await fetch(`/api/workflows/${workflowId}/document-templates`, {
        method: "POST",
        body: fd,
      })

      interface UploadResponseShape {
        id?: string
        name?: string
        error?: string
      }

      const json = (await res.json().catch(() => ({}))) as UploadResponseShape
      const id = typeof json.id === "string" ? json.id : ""
      const name = typeof json.name === "string" ? json.name : file.name
      if (!res.ok || !id) {
        setError(typeof json.error === "string" ? json.error : "Upload failed.")
        return
      }

      // Remove any prior template blob after successful registration of the replacement.
      const previousTemplateId = templateFileId.trim()
      if (previousTemplateId && previousTemplateId !== id) {
        await fetch(`/api/workflows/${workflowId}/document-templates/${previousTemplateId}`, {
          method: "DELETE",
        }).catch(() => {})
      }

      onTemplateRegistered({ templateFileId: id, templateFileName: name })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  /** Opens the OS file picker (accepts `.doc`/`.docx` only — matches templates bucket MIME policy). */
  function openPicker() {
    fileInputRef.current?.click()
  }

  /** Handles picker selection and kicks off multipart upload via the workflows API route. */
  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadSelectedFile({ file })
  }

  /** Accepts dragged Word files dropped onto the hit target. */
  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await uploadSelectedFile({ file })
  }

  /** Removes the persisted template metadata and deletes the backing storage object first. */
  async function confirmDeleteExistingTemplate() {
    if (!canUpload || !workflowId) return
    const idToDelete = templateFileId.trim()
    if (!idToDelete) return
    setError(null)
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/workflows/${workflowId}/document-templates/${idToDelete}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        interface DeleteJson {
          error?: string
        }
        const failure = (await res.json().catch(() => ({}))) as DeleteJson
        const message =
          typeof failure.error === "string"
            ? failure.error
            : "Could not remove the stored template."
        setError(message)
        return
      }
      onTemplateRemoved()
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Word template</p>
          <p className="text-[11px] text-muted-foreground">
            Stored in{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              {WORKFLOW_DOCUMENT_TEMPLATES_BUCKET}
            </code>{' '}
            (generated documents use a separate outputs bucket).
          </p>
        </div>
      </div>

      {/* Drop / pick surface */}
      <div
        title={
          hasTemplate
            ? "Drag and drop another Word file here to replace this template."
            : undefined
        }
        className={cn(
          "group relative rounded-xl border border-dashed border-border/80 bg-muted/15 transition-colors",
          hasTemplate ? "px-4 py-3" : "px-4 py-6 text-center",
          dragActive && "border-primary/60 bg-primary/5",
          !canUpload && "opacity-60",
        )}
        onDragEnter={(e: React.DragEvent) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault()
        }}
        onDrop={(e: React.DragEvent<HTMLDivElement>) => void handleDrop(e)}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => void handleFileInputChange(e)}
        />

        {hasTemplate ? (
          /* Template attached — compact row; remove appears on hover (right). */
          <div className="flex min-h-10 items-center gap-3">
            {isUploading ? (
              <div className="flex flex-1 items-center justify-center gap-2 py-1">
                <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Uploading…</span>
              </div>
            ) : (
              <>
                <FileText
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                  {templateFileName.trim() || "Uploaded template"}
                </span>
                {/* Remove — visible on row hover */}
                <button
                  type="button"
                  disabled={!canUpload || isUploading || isDeleting}
                  onClick={() => setDeleteOpen(true)}
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-destructive",
                    "opacity-0 transition-opacity duration-150",
                    "pointer-events-none hover:bg-destructive/10 focus-visible:pointer-events-auto focus-visible:opacity-100",
                    "group-hover:pointer-events-auto group-hover:opacity-100",
                  )}
                  aria-label="Remove template"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden />
                </button>
              </>
            )}
          </div>
        ) : (
          /* No template — invite drop or browse */
          <div className="flex flex-col items-center gap-2">
            {isUploading ? (
              <Loader2 aria-hidden className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <Upload aria-hidden className="size-8 text-muted-foreground/80" />
            )}
            <p className="text-sm font-medium">
              Drop a <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.docx</code> or{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.doc</code> template here
            </p>
            <p className="text-xs text-muted-foreground">
              Or{' '}
              <button
                type="button"
                className={cn(
                  "font-medium underline-offset-4 hover:underline disabled:pointer-events-none",
                  (!canUpload || isUploading) && "opacity-40",
                )}
                disabled={!canUpload || isUploading || isDeleting}
                onClick={openPicker}
              >
                browse to choose a file
              </button>
              .
            </p>
          </div>
        )}
      </div>

      {/* Validation / blocker messages */}
      {blockingReason ? (
        <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
          {blockingReason}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the Word file from{' '}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">
                {WORKFLOW_DOCUMENT_TEMPLATES_BUCKET}
              </code>{' '}
              and clears this step&apos;s template reference. Other artefacts remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                void confirmDeleteExistingTemplate()
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Removing
                </>
              ) : (
                'Delete from storage'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
