"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"

export type PromptTagNamespaceGroup = {
  label: string
  tags: PromptTagDefinition[]
}

/**
 * Groups prompt tags by the first path segment (namespace) for organised selects.
 */
export function groupPromptTagsByNamespace({
  tags,
}: {
  tags: PromptTagDefinition[]
}): PromptTagNamespaceGroup[] {
  const groups: Record<string, PromptTagDefinition[]> = {}
  const ORDER = ["input", "prev", "global", "trigger", "const", "now"]

  for (const tag of tags) {
    const ns = tag.id.split(".")[0] ?? "other"
    if (!groups[ns]) groups[ns] = []
    groups[ns]?.push(tag)
  }

  const nsLabels: Record<string, string> = {
    input: "Step inputs",
    prev: "Previous step",
    global: "Workflow globals",
    trigger: "Trigger payload",
    const: "Workflow constants",
    now: "Date & time",
  }

  const result: PromptTagNamespaceGroup[] = []
  for (const ns of ORDER) {
    const t = groups[ns]
    if (t && t.length > 0) {
      result.push({ label: nsLabels[ns] ?? ns, tags: t })
    }
  }
  for (const [ns, t] of Object.entries(groups)) {
    if (!ORDER.includes(ns) && t.length > 0) {
      result.push({ label: nsLabels[ns] ?? ns, tags: t })
    }
  }
  return result
}

export type PromptTagFieldSelectProps = {
  id: string
  value: string
  tags: PromptTagDefinition[]
  onChange: ({ value }: { value: string }) => void
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  /** Shown inside the menu when {@link tags} is empty. */
  emptyState?: React.ReactNode
}

const DEFAULT_EMPTY_STATE = (
  <div className="px-3 py-4 text-center">
    <p className="text-xs text-muted-foreground leading-relaxed">
      No fields available. Define inputs on the <span className="font-medium text-foreground">Input</span> tab or
      connect an upstream step to populate this list.
    </p>
  </div>
)

/**
 * Single-select for one prompt tag id: human-readable label on the first line, token path underneath.
 * Supports unknown stored ids (custom paths) without losing the closed-trigger display.
 */
export function PromptTagFieldSelect({
  id,
  value,
  tags,
  onChange,
  placeholder = "Select a field…",
  disabled,
  triggerClassName,
  contentClassName,
  emptyState = DEFAULT_EMPTY_STATE,
}: PromptTagFieldSelectProps) {
  const grouped = React.useMemo(() => groupPromptTagsByNamespace({ tags }), [tags])
  const selectedTag = tags.find((t) => t.id === value)
  const isKnown = selectedTag != null

  return (
    <Select
      value={isKnown ? value : value ? "__custom__" : ""}
      onValueChange={(v) => {
        if (v == null || v === "") return
        if (v !== "__custom__") onChange({ value: v })
      }}
    >
      {/* Trigger: two-line summary when a known tag is selected */}
      <SelectTrigger
        disabled={disabled}
        id={id}
        className={cn(
          "h-auto min-h-8 w-full min-w-0 items-start gap-2 whitespace-normal py-1.5 text-xs data-[size=default]:h-auto",
          "*:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:flex-col *:data-[slot=select-value]:items-start *:data-[slot=select-value]:gap-0.5 *:data-[slot=select-value]:text-left",
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder}>
          {value ? (
            selectedTag ? (
              <span className="flex min-w-0 flex-col gap-0.5 text-left">
                <span className="truncate font-medium text-foreground">{selectedTag.label}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">{selectedTag.id}</span>
              </span>
            ) : (
              <span className="font-mono text-[var(--purple)] truncate">{value}</span>
            )
          ) : (
            <span className="text-muted-foreground font-sans">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>

      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className={cn("min-w-[min(100vw-2rem,18rem)] max-w-sm", contentClassName)}
      >
        {tags.length === 0 ? (
          emptyState
        ) : (
          <>
            {/* Namespace sections */}
            {grouped.map((group, gi) => (
              <React.Fragment key={group.label}>
                {gi > 0 ? <SelectSeparator /> : null}
                <SelectGroup>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.tags.map((tag) => (
                    <SelectItem
                      key={tag.id}
                      value={tag.id}
                      className="items-start py-2"
                      itemTextClassName="min-w-0 flex-col items-stretch gap-0.5 whitespace-normal"
                    >
                      {/* Primary: friendly label */}
                      <span className="text-xs font-medium leading-snug text-foreground">{tag.label}</span>
                      {/* Secondary: interpolation path */}
                      <span className="break-all font-mono text-[11px] leading-snug text-muted-foreground">
                        {tag.id}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </React.Fragment>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  )
}
