"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import { mergeIncomingInputFieldsAppend } from "@/lib/workflows/engine/input-schema"
import {
  WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS,
  type WorkflowInputSchemaFromPromptFlavourId,
} from "@/lib/workflows/input-schema-from-prompt-flavours"

export interface SchemaFromPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flavourId: WorkflowInputSchemaFromPromptFlavourId
  existingFields: NodeInputField[]
  /** Optional heading override (defaults from flavour registry). */
  title?: string
  /** Optional helper copy override. */
  description?: string
  /**
   * Receives the merged or replaced schema rows ready for persistence.
   *
   * @param params - Final field list after merge rules run inside the dialog.
   */
  onApply: ({ fields }: { fields: NodeInputField[] }) => void
}

type MergeMode = "replace" | "append"

/**
 * Modal workflow for turning natural language into {@link NodeInputField} rows via the gateway-backed agent.
 */
export function SchemaFromPromptDialog({
  open,
  onOpenChange,
  flavourId,
  existingFields,
  title,
  description,
  onApply,
}: SchemaFromPromptDialogProps) {
  const [promptDraft, setPromptDraft] = React.useState("")
  const [mergeMode, setMergeMode] = React.useState<MergeMode>("replace")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [modelNotes, setModelNotes] = React.useState<string | null>(null)
  const [completionMessage, setCompletionMessage] = React.useState<string | null>(null)

  const flavourCopy = WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS[flavourId]
  const resolvedTitle = title ?? flavourCopy.dialogTitle
  const resolvedDescription = description ?? flavourCopy.dialogDescription

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    setModelNotes(null)
    try {
      const response = await fetch("/api/workflow/input-schema/from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptDraft, flavourId }),
      })
      const payload: unknown = await response.json()
      const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
      if (!rec || rec.ok !== true || !Array.isArray(rec.fields)) {
        const message = typeof rec?.error === "string" ? rec.error : "Unable to generate schema."
        setError(message)
        return
      }
      const incoming = rec.fields as NodeInputField[]
      const notes = typeof rec.notes === "string" && rec.notes.trim() ? rec.notes.trim() : null
      if (notes) setModelNotes(notes)

      let nextFields: NodeInputField[]
      let summary: string
      if (mergeMode === "replace") {
        nextFields = incoming
        summary = `Replaced with ${incoming.length} generated field${incoming.length === 1 ? "" : "s"}.`
      } else {
        const { merged, skippedDuplicateKeys } = mergeIncomingInputFieldsAppend({
          existing: existingFields,
          incoming,
        })
        nextFields = merged
        if (skippedDuplicateKeys.length > 0) {
          summary = `Appended ${incoming.length - skippedDuplicateKeys.length} field${
            incoming.length - skippedDuplicateKeys.length === 1 ? "" : "s"
          }; skipped ${skippedDuplicateKeys.length} duplicate key${
            skippedDuplicateKeys.length === 1 ? "" : "s"
          } (${skippedDuplicateKeys.join(", ")}).`
        } else {
          summary = `Appended ${incoming.length} field${incoming.length === 1 ? "" : "s"}.`
        }
      }

      onApply({ fields: nextFields })
      setCompletionMessage(summary)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Network error."
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex max-h-[90vh] flex-col gap-3 overflow-hidden sm:max-w-lg")}
        showCloseButton={!submitting}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>

        {/* Scroll middle so long prompts cannot push the footer off-screen */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {completionMessage ? (
            <>
              {/* Success recap */}
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left text-xs font-medium text-emerald-900 dark:text-emerald-50">
                {completionMessage}
              </p>
              {modelNotes ? (
                <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">{modelNotes}</p>
              ) : null}
            </>
          ) : (
            <>
              {/* Merge strategy */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">How to apply</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mergeMode === "replace" ? "default" : "outline"}
                    className="font-normal"
                    onClick={() => setMergeMode("replace")}
                    disabled={submitting}
                  >
                    Replace existing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mergeMode === "append" ? "default" : "outline"}
                    className="font-normal"
                    onClick={() => setMergeMode("append")}
                    disabled={submitting}
                  >
                    Append new keys
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Append keeps your current fields and only adds keys that are not already defined.
                </p>
              </div>

              {/* Prompt capture — capped height; scroll inside the field */}
              <div className="space-y-2">
                <Label htmlFor="schema-prompt" className="text-xs font-medium text-muted-foreground">
                  Prompt
                </Label>
                <Textarea
                  id="schema-prompt"
                  value={promptDraft}
                  onChange={(e) => {
                    setPromptDraft(e.target.value)
                    setError(null)
                  }}
                  placeholder="Example: The template has {client_name}, {invoice_total}, and a repeating table for line items with description, quantity, and amount."
                  rows={8}
                  spellCheck
                  className="max-h-[min(500px,90vh)] min-h-[9rem] resize-y overflow-y-auto text-sm leading-relaxed"
                  disabled={submitting}
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                >
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Actions stay pinned at the bottom of the dialog */}
        <DialogFooter className="shrink-0 sm:justify-end">
          {completionMessage ? (
            <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !promptDraft.trim()}>
                <Sparkles className="mr-2 size-4" aria-hidden />
                {submitting ? "Generating…" : "Generate & insert"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface SchemaFromPromptImportTriggerProps {
  compact?: boolean
  disabled?: boolean
  /** Opens the upstream dialog controlled by parents. */
  onOpen: () => void
}

/**
 * Lightweight button surfaced next to schema editors whenever prompt imports are enabled.
 */
export function SchemaFromPromptImportTrigger({ compact = false, disabled = false, onOpen }: SchemaFromPromptImportTriggerProps) {
  return (
    <Button type="button" variant="outline" size={compact ? "sm" : "default"} className="shrink-0 font-normal" disabled={disabled} onClick={onOpen}>
      <Sparkles className={cn("text-muted-foreground", compact ? "mr-1.5 size-3.5" : "mr-2 size-4")} aria-hidden />
      Import from prompt
    </Button>
  )
}
