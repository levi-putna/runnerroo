"use client"

import * as React from "react"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

/** Builds the initial keyed string map backing the controlled fields. */
function deriveDraftFromFields({ fields }: { fields: NodeInputField[] }): Record<string, string> {
  const next: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === "boolean") {
      const v = typeof f.value === "string" ? f.value.toLowerCase() : ""
      next[f.key] = v === "true" ? "true" : "false"
    } else if (typeof f.value === "string") {
      next[f.key] = f.value
    } else {
      next[f.key] = ""
    }
  }
  return next
}

export interface ManualWorkflowRunDialogProps {
  /** When true, dialog is shown. */
  open: boolean
  /** Closed state handler. */
  onOpenChange: (open: boolean) => void
  /** Field definitions copied from the entry node `inputSchema`. */
  fields: NodeInputField[]
  /** True while submitting / streaming begins. */
  isSubmitting: boolean
  /** Called after validation with coerced payloads keyed by field key. */
  onRun: (p: { values: Record<string, unknown> }) => void | Promise<void>
}

/**
 * Modal form for editing manual trigger payloads before executing the simulated runner.
 */
export function ManualWorkflowRunDialog({
  open,
  onOpenChange,
  fields,
  isSubmitting,
  onRun,
}: ManualWorkflowRunDialogProps) {
  /** Fresh object each dialog mount (`key` bumped by parent when opening). */
  const [draft, setDraft] = React.useState(() => deriveDraftFromFields({ fields }))

  /** Submit — validate required fields then coerce typed values */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing = fields.some((f) => {
      if (f.type === "boolean") return false
      const raw = draft[f.key]?.trim() ?? ""
      return f.required && raw === ""
    })
    if (missing) return

    const values: Record<string, unknown> = {}
    for (const f of fields) {
      const raw = draft[f.key] ?? ""
      if (f.type === "boolean") {
        values[f.key] = String(raw).toLowerCase() === "true"
      } else if (f.type === "number") {
        const n = Number(String(raw))
        values[f.key] = Number.isFinite(n) ? n : raw
      } else {
        values[f.key] = raw
      }
    }

    await onRun({ values })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Manual run */}
      <DialogContent showCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run workflow manually</DialogTitle>
          <DialogDescription>
            Adjust inputs for this execution. Trigger inputs are forwarded to the simulated runner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Input fields */}
          <div className="space-y-3 max-h-[min(420px,calc(100vh-260px))] overflow-y-auto pr-1">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No input fields declared on this entry node yet. You can run with an empty payload.
              </p>
            ) : null}

            {fields.map((field) => {
              const fid = `${field.key}-${field.id}`
              /** Boolean toggle */
              if (field.type === "boolean") {
                const checked = draft[field.key]?.toLowerCase() === "true"
                return (
                  <div
                    key={fid}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor={fid} className="cursor-pointer truncate">
                        {field.label}
                        {field.required ? <span className="text-red-600">{" *"}</span> : null}
                      </Label>
                      {field.description ? (
                        <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                      ) : null}
                    </div>
                    <Switch
                      id={fid}
                      checked={checked}
                      onCheckedChange={(c) =>
                        setDraft((d) => ({ ...d, [field.key]: c ? "true" : "false" }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                )
              }

              /** Multi-line prompt */
              if (field.type === "text") {
                return (
                  <div key={fid} className="space-y-1.5">
                    <Label htmlFor={fid}>
                      {field.label}
                      {field.required ? <span className="text-red-600">{" *"}</span> : null}
                    </Label>
                    {field.description ? (
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    ) : null}
                    <Textarea
                      id={fid}
                      value={draft[field.key] ?? ""}
                      onChange={(ev) =>
                        setDraft((d) => ({ ...d, [field.key]: ev.target.value }))
                      }
                      rows={4}
                      disabled={isSubmitting}
                      required={field.required}
                    />
                  </div>
                )
              }

              /** Short string / number */
              const isNumber = field.type === "number"
              return (
                <div key={fid} className="space-y-1.5">
                  <Label htmlFor={fid}>
                    {field.label}
                    {field.required ? <span className="text-red-600">{" *"}</span> : null}
                  </Label>
                  {field.description ? (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  ) : null}
                  <Input
                    id={fid}
                    type={isNumber ? "number" : "text"}
                    value={draft[field.key] ?? ""}
                    onChange={(ev) =>
                      setDraft((d) => ({ ...d, [field.key]: ev.target.value }))
                    }
                    disabled={isSubmitting}
                    required={field.required}
                  />
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <DialogFooter className="gap-2 sm:justify-end flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Starting…" : "Run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
