"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { MoreHorizontal, Sparkles } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import type { WorkflowInputSchemaFromPromptFlavourId } from "@/lib/workflows/input-schema-from-prompt-flavours"
import { SchemaFromPromptDialog } from "@/components/workflow/schema-from-prompt-dialog"

/** How a confirmable import merges with rows already in the editor (when the dialog offers a choice). */
export type WorkflowSchemaImportApplyMode = "replace" | "append"

/** Confirmed merge/sync action surfaced on schema panel headers (after user accepts the alert). */
export interface WorkflowSchemaConfirmableImport {
  /** Stable discriminator for dropdown keys and diagnostics. */
  id: string
  label: string
  TriggerIcon?: LucideIcon
  disabled?: boolean
  alertTitle: string
  alertDescription: React.ReactNode
  cancelLabel?: string
  confirmLabel: string
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
  /**
   * When true, the confirmation dialog offers replace vs append (same idea as prompt import).
   * The chosen mode is passed to {@link onConfirm}; when false, omit {@link params.applyMode} and callers should merge.
   */
  offerApplyModeChoice?: boolean
  /**
   * Runs after the author confirms. When {@link offerApplyModeChoice} is set, `applyMode` reflects their choice.
   *
   * @param params - Optional bag; `applyMode` is present only when {@link offerApplyModeChoice} is true.
   */
  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => void
}

/** Prompt-backed generation — matches {@link WorkflowInputSchemaFromPromptFlavourId} registry entries. */
export interface WorkflowSchemaBuilderToolbarPromptImport {
  flavourId: WorkflowInputSchemaFromPromptFlavourId
  dialogTitle?: string
  dialogDescription?: string
}

/**
 * Clipboard / dialog-driven JSON bulk edits mirrored from the schema panel menu.
 * When {@link WorkflowSchemaBulkJsonMenuActions.visible} is false, omit JSON entries (e.g. drill-down sub-views).
 */
export interface WorkflowSchemaBulkJsonMenuActions {
  visible: boolean
  /** Opens the JSON editor dialog (parent-owned). */
  onEditAsJson: () => void
  /** Copies serialised schema JSON to the clipboard. */
  onCopyJson: () => void | Promise<void>
  /** Reads clipboard text and continues with parent-defined merge UX. */
  onImportJsonFromClipboard: () => void | Promise<void>
}

export interface WorkflowSchemaBuilderToolbarProps {
  /** Confirm-before syncs — each becomes a dropdown row (no separate primary button). */
  confirmableImports?: WorkflowSchemaConfirmableImport[]
  promptImport?: WorkflowSchemaBuilderToolbarPromptImport | null
  existingFields: NodeInputField[]
  onPromptApplyFields: ({ fields }: { fields: NodeInputField[] }) => void
  /** Optional JSON import/export/edit entries appended after imports (with a separator when both exist). */
  bulkJsonMenu?: WorkflowSchemaBulkJsonMenuActions | null
}

type ConfirmTarget = WorkflowSchemaConfirmableImport | null

/**
 * Compact schema header menu: confirmable imports, prompt generation, and optional JSON bulk actions.
 */
export function WorkflowSchemaBuilderToolbar({
  confirmableImports = [],
  promptImport,
  existingFields,
  onPromptApplyFields,
  bulkJsonMenu,
}: WorkflowSchemaBuilderToolbarProps) {
  const [confirmTarget, setConfirmTarget] = React.useState<ConfirmTarget>(null)
  const [confirmApplyMode, setConfirmApplyMode] = React.useState<WorkflowSchemaImportApplyMode>("append")
  const [promptOpen, setPromptOpen] = React.useState(false)
  const [promptSession, setPromptSession] = React.useState(0)

  /** Opens a confirmable import and resets merge mode so each prompt starts from append. */
  const openConfirmable = React.useCallback((row: WorkflowSchemaConfirmableImport) => {
    setConfirmApplyMode("append")
    setConfirmTarget(row)
  }, [])

  const confirmables = [...confirmableImports].filter((row) => row != null)
  const promptEnabled = Boolean(promptImport)
  const bulkVisible = bulkJsonMenu?.visible === true

  const openPromptFlow = React.useCallback(() => {
    setPromptSession((s) => s + 1)
    setPromptOpen(true)
  }, [])

  const topSectionCount = confirmables.length + (promptEnabled ? 1 : 0)
  const showBulkSection = bulkVisible && bulkJsonMenu != null

  if (topSectionCount === 0 && !showBulkSection) {
    return null
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2 self-start">
      {/* Schema actions — single compact menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0 border-border/80 shadow-none"
            aria-label="Schema actions"
          >
            <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {confirmables.map((item) => {
            const RowIcon = item.TriggerIcon
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={item.disabled}
                onSelect={() => {
                  openConfirmable(item)
                }}
              >
                {RowIcon ? <RowIcon className="mr-2 size-4 text-muted-foreground" aria-hidden /> : null}
                {item.label}
              </DropdownMenuItem>
            )
          })}
          {promptEnabled ? (
            <DropdownMenuItem
              onSelect={() => {
                openPromptFlow()
              }}
            >
              <Sparkles className="mr-2 size-4 text-muted-foreground" aria-hidden />
              Import from prompt
            </DropdownMenuItem>
          ) : null}
          {topSectionCount > 0 && showBulkSection ? <DropdownMenuSeparator /> : null}
          {showBulkSection ? (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  bulkJsonMenu.onEditAsJson()
                }}
              >
                Edit as JSON…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void bulkJsonMenu.onCopyJson()
                }}
              >
                Copy JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void bulkJsonMenu.onImportJsonFromClipboard()
                }}
              >
                Import JSON from clipboard…
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmTarget ? (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTarget.alertTitle}</AlertDialogTitle>
              <AlertDialogDescription className="text-left">
                <div className="space-y-4">
                  <div className="leading-relaxed">{confirmTarget.alertDescription}</div>
                  {confirmTarget.offerApplyModeChoice ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-foreground">How to apply</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={confirmApplyMode === "append" ? "default" : "outline"}
                          className="font-normal"
                          onClick={() => setConfirmApplyMode("append")}
                        >
                          Append new keys
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={confirmApplyMode === "replace" ? "default" : "outline"}
                          className="font-normal"
                          onClick={() => setConfirmApplyMode("replace")}
                        >
                          Replace existing
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Append keeps your current rows and merges placeholders into matching keys. Replace rebuilds the list
                        from this import source only.
                      </p>
                    </div>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{confirmTarget.cancelLabel ?? "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                variant={confirmTarget.confirmVariant ?? "default"}
                onClick={() => {
                  if (confirmTarget.offerApplyModeChoice) {
                    confirmTarget.onConfirm({ applyMode: confirmApplyMode })
                  } else {
                    confirmTarget.onConfirm()
                  }
                  setConfirmTarget(null)
                }}
              >
                {confirmTarget.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {promptImport ? (
        <SchemaFromPromptDialog
          key={promptSession}
          open={promptOpen}
          onOpenChange={setPromptOpen}
          flavourId={promptImport.flavourId}
          existingFields={existingFields}
          title={promptImport.dialogTitle}
          description={promptImport.dialogDescription}
          onApply={({ fields: next }) => onPromptApplyFields({ fields: next })}
        />
      ) : null}
    </div>
  )
}
