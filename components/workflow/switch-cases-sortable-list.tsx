"use client"

import * as React from "react"
import { GitBranch, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WorkflowEditableListRow } from "@/components/workflow/workflow-editable-list-row"
import {
  WorkflowSchemaRowsSortableList,
  WorkflowSchemaSortableGrip,
} from "@/components/workflow/workflow-schema-rows-sortable-list"
import { cn } from "@/lib/utils"
import { reorderItemsByGapIndex } from "@/lib/workflows/reorder-items-by-gap"
import type { SwitchBranch } from "@/lib/workflows/steps/logic/switch/node"

/**
 * Moves one branch to a gap index (0 = before first item, `branches.length` = after last).
 */
export function reorderSwitchBranchToGap({
  branches,
  activeId,
  gapIndex,
}: {
  branches: SwitchBranch[]
  activeId: string
  gapIndex: number
}): SwitchBranch[] {
  return reorderItemsByGapIndex({ items: branches, activeId, gapIndex })
}

export type SwitchCasesSortableListProps = {
  branches: SwitchBranch[]
  onReorder: ({ next }: { next: SwitchBranch[] }) => void
  onActivateCase: ({ branchId }: { branchId: string }) => void
  onRemoveCase: ({ branchId }: { branchId: string }) => void
}

/**
 * Switch case list with @dnd-kit vertical sorting — drop zones sit **between** rows (blue bar + 6px padding each side).
 */
export function SwitchCasesSortableList({
  branches,
  onReorder,
  onActivateCase,
  onRemoveCase,
}: SwitchCasesSortableListProps) {
  return (
    <WorkflowSchemaRowsSortableList
      items={branches}
      onReorder={onReorder}
      renderDragOverlay={({ item }) => (
        <div className="pointer-events-none flex min-w-[240px] items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 shadow-lg">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
            <GitBranch className="size-4" aria-hidden />
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            {item.label?.trim() ? item.label : "Unnamed case"}
          </span>
        </div>
      )}
      renderRow={({
        item: branch,
        index,
        spacingBelow,
        isDragging,
        sortableStyle,
        mergedSortableRef,
        setActivatorNodeRef,
        dragAttributes,
        dragListeners,
      }) => {
        const displayName = branch.label?.trim() ? branch.label : "Unnamed case"
        return (
          <div
            ref={mergedSortableRef}
            style={sortableStyle}
            className={cn(isDragging && "relative z-[1] opacity-[0.35]", spacingBelow && "mb-2")}
          >
            <WorkflowEditableListRow
              suppressFocusChrome
              leading={
                <WorkflowSchemaSortableGrip
                  setActivatorNodeRef={setActivatorNodeRef}
                  attributes={dragAttributes}
                  listeners={dragListeners}
                  ariaLabel="Drag to reorder case"
                />
              }
              onActivate={() => onActivateCase({ branchId: branch.id })}
              showChevron
              trailing={
                branches.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onRemoveCase({ branchId: branch.id })
                    }}
                    aria-label={`Remove case ${displayName}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : undefined
              }
            >
              {/* Branch glyph */}
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                <GitBranch className="size-4" aria-hidden />
              </span>
              {/* Case name + ordinal */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                    Case {index + 1}
                  </Badge>
                </div>
              </div>
            </WorkflowEditableListRow>
          </div>
        )
      }}
    />
  )
}
