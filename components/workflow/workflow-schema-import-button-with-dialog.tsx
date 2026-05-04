"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

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
import { cn } from "@/lib/utils"

export interface WorkflowSchemaImportButtonWithDialogProps {
  disabled?: boolean
  triggerLabel: string
  TriggerIcon?: LucideIcon
  triggerClassName?: string
  alertTitle: string
  alertDescription: React.ReactNode
  cancelLabel?: string
  confirmLabel: string
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
  /** Called after the caller confirms inside the alert; the dialog closes immediately afterwards. */
  onConfirm: () => void
}

/**
 * Outline import trigger with a consistent alert-dialog confirmation.
 * Embed under a locale-specific section heading (for example upstream mapping or payload parity).
 */
export function WorkflowSchemaImportButtonWithDialog({
  disabled,
  triggerLabel,
  TriggerIcon,
  triggerClassName,
  alertTitle,
  alertDescription,
  cancelLabel = "Cancel",
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
}: WorkflowSchemaImportButtonWithDialogProps) {
  const [open, setOpen] = React.useState(false)
  const Icon = TriggerIcon

  return (
    <>
      {/* Primary touch target — deliberately wide for parity with manual-test / webhook forms */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("w-full gap-2", triggerClassName)}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        {triggerLabel}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertDescription}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmVariant}
              onClick={() => {
                onConfirm()
                setOpen(false)
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
