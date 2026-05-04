"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import { FunctionInput } from "@/components/workflow/function-input"
import type { PromptTagDefinition } from "@/lib/workflow/prompt-tags"
import { cn } from "@/lib/utils"

export type SystemPromptFieldProps = {
  /** Declared tokens (shown as `{{id}}`) with descriptions for autocomplete and the expanded palette. */
  tags: PromptTagDefinition[]
  value: string
  onChange: ({ value }: { value: string }) => void
  /** Stable key for the underlying mentions widget (e.g. workflow node id). */
  fieldInstanceId: string
  helperText?: string
  /** Optional visible label above the field; omit when a parent section already titles the block. */
  label?: string
  className?: string
} & Omit<
  React.ComponentProps<typeof FunctionInput>,
  "tags" | "value" | "onChange" | "fieldInstanceId" | "className"
>

/**
 * Reusable system-prompt control: `{{tag}}` autocomplete, styled mentions, expand dialog, and draggable tags.
 */
export function SystemPromptField({
  tags,
  value,
  onChange,
  fieldInstanceId,
  helperText,
  label,
  className,
  id,
  ...textareaProps
}: SystemPromptFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Optional heading when this field is used outside a pre-labelled section */}
      {label ? (
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </Label>
      ) : null}

      <FunctionInput
        tags={tags}
        value={value}
        onChange={onChange}
        fieldInstanceId={fieldInstanceId}
        id={id}
        {...textareaProps}
      />

      {helperText ? <p className="text-xs leading-relaxed text-muted-foreground">{helperText}</p> : null}
    </div>
  )
}
