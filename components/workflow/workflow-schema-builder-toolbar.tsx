"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronDown, Sparkles } from "lucide-react"

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import type { WorkflowInputSchemaFromPromptFlavourId } from "@/lib/workflows/input-schema-from-prompt-flavours"
import { SchemaFromPromptDialog } from "@/components/workflow/schema-from-prompt-dialog"

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
  onConfirm: () => void
}

/** Prompt-backed generation — matches {@link WorkflowInputSchemaFromPromptFlavourId} registry entries. */
export interface WorkflowSchemaBuilderToolbarPromptImport {
  flavourId: WorkflowInputSchemaFromPromptFlavourId
  dialogTitle?: string
  dialogDescription?: string
}

export interface WorkflowSchemaBuilderToolbarProps {
  /** Highest-priority confirmable imports first — they anchor the combined button when grouped. */
  confirmableImports?: WorkflowSchemaConfirmableImport[]
  promptImport?: WorkflowSchemaBuilderToolbarPromptImport | null
  existingFields: NodeInputField[]
  onPromptApplyFields: ({ fields }: { fields: NodeInputField[] }) => void
}

type ConfirmTarget = WorkflowSchemaConfirmableImport | null

/**
 * Composes confirm-before syncs and AI prompt fills for schema panels.
 * Renders a split control with a chevron only when more than one action is available.
 */
export function WorkflowSchemaBuilderToolbar({
  confirmableImports = [],
  promptImport,
  existingFields,
  onPromptApplyFields,
}: WorkflowSchemaBuilderToolbarProps) {
  const [confirmTarget, setConfirmTarget] = React.useState<ConfirmTarget>(null)
  const [promptOpen, setPromptOpen] = React.useState(false)
  const [promptSession, setPromptSession] = React.useState(0)

  const confirmables = [...confirmableImports].filter((row) => row != null)
  const primaryConfirmable = confirmables[0]
  const overflowConfirmables = confirmables.slice(1)
  const promptEnabled = Boolean(promptImport)

  const overflowSlots = overflowConfirmables.length + (promptEnabled ? 1 : 0)
  const showDropdown = overflowSlots > 0
  const promptStandalone = promptEnabled && !primaryConfirmable

  const openPromptFlow = React.useCallback(() => {
    setPromptSession((s) => s + 1)
    setPromptOpen(true)
  }, [])

  if (!primaryConfirmable && !promptEnabled) {
    return null
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      {/* Primary control — fills the row when it is the only affordance */}
      {promptStandalone ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openPromptFlow}
          className="h-8 gap-2 font-normal"
        >
          <Sparkles className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          Import from prompt
        </Button>
      ) : primaryConfirmable ? (
        <div
          className={cn(
            "inline-flex items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-sm",
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={primaryConfirmable.disabled}
            onClick={() => setConfirmTarget(primaryConfirmable)}
            className={cn(
              "h-8 min-w-0 gap-2 border-0 px-3 font-normal shadow-none hover:bg-accent",
              showDropdown ? "max-w-[9rem] rounded-none sm:max-w-[13rem]" : "max-w-[16rem] rounded-none sm:max-w-[18rem]",
            )}
          >
            {(() => {
              const PrimaryIcon = primaryConfirmable.TriggerIcon
              return PrimaryIcon ? <PrimaryIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null
            })()}
            <span className="truncate">{primaryConfirmable.label}</span>
          </Button>
          {showDropdown ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 min-w-8 shrink-0 rounded-none border-0 border-l border-input/80 px-2 font-normal shadow-none hover:bg-accent"
                  aria-label="More schema import options"
                >
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {overflowConfirmables.map((item) => {
                  const RowIcon = item.TriggerIcon
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      disabled={item.disabled}
                      onSelect={() => {
                        setConfirmTarget(item)
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
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      {confirmTarget ? (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTarget.alertTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="leading-relaxed">{confirmTarget.alertDescription}</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{confirmTarget.cancelLabel ?? "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                variant={confirmTarget.confirmVariant ?? "default"}
                onClick={() => {
                  confirmTarget.onConfirm()
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
