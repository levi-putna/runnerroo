"use client"

import * as React from "react"
import { Braces, LayoutList, Plus, Tag, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ExpressionInput } from "@/components/workflow/expression-input"
import { clipWorkflowFieldKeyInput } from "@/lib/workflows/engine/input-schema"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"
import {
  createEmptyClassifyLabelPersistedRow,
  readClassifyLabelRowsFromNodeData,
  type ClassifyLabelRowPersisted,
} from "@/lib/workflows/steps/ai/classify/defaults"
import {
  WorkflowSchemaRowsSortableList,
  WorkflowSchemaSortableGrip,
} from "@/components/workflow/workflow-schema-rows-sortable-list"

export interface ClassifyCatalogueEditorProps {
  data: Record<string, unknown>
  set: (key: string, value: unknown) => void
  nodeId: string
  promptTags: PromptTagDefinition[]
}

function emptyAddDraft(): { label: string; description: string } {
  return { label: "", description: "" }
}

/**
 * Category catalogue UI for Classify steps: card shell and list UX aligned with {@link InputSchemaBuilder}.
 */
export function ClassifyCatalogueEditor({ data, set, nodeId, promptTags }: ClassifyCatalogueEditorProps) {
  const rows = readClassifyLabelRowsFromNodeData({ value: data.classifyLabels })
  const labelsFromExpression = Boolean(data.classifyLabelsFromExpression)
  const editorTab = labelsFromExpression ? "expression" : "visual"

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState<{ label: string; description: string } | null>(null)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [addDraft, setAddDraft] = React.useState(() => emptyAddDraft())

  function replaceRows(next: ClassifyLabelRowPersisted[]) {
    set("classifyLabels", next)
  }

  function handleEditorTabChange({ next }: { next: string }) {
    if (next !== "visual" && next !== "expression") return
    const isExpression = next === "expression"
    set("classifyLabelsFromExpression", isExpression)
    if (isExpression) {
      setEditingId(null)
      setEditDraft(null)
    }
  }

  function openEdit({ row }: { row: ClassifyLabelRowPersisted }) {
    setShowAddForm(false)
    setEditingId(row.id)
    setEditDraft({ label: row.label, description: row.description })
  }

  function closeEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  function saveEdit({ id }: { id: string }) {
    if (!editDraft) return
    replaceRows(
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              label: clipWorkflowFieldKeyInput({ value: editDraft.label }),
              description: editDraft.description.trim(),
            }
          : r,
      ),
    )
    closeEdit()
  }

  function removeRow({ id }: { id: string }) {
    replaceRows(rows.filter((r) => r.id !== id))
    if (editingId === id) closeEdit()
  }

  function addCategoryFromDraft() {
    const label = clipWorkflowFieldKeyInput({ value: addDraft.label })
    const description = addDraft.description.trim()
    const row = createEmptyClassifyLabelPersistedRow({ partial: { label, description } })
    replaceRows([...rows, row])
    setAddDraft(emptyAddDraft())
    setShowAddForm(false)
  }

  return (
    <div
      className={cn(
        "min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40",
      )}
    >
      {/* Panel header — matches InputSchemaBuilder */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background"
          aria-hidden
        >
          <Tag className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">Category catalogue</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Unique labels and descriptions are injected into the classifier as JSON. Prefer stable identifiers
            (letters, digits, hyphens, underscores).
          </p>
        </div>
      </div>

      <div className="space-y-0 px-4 pb-4 pt-3">
        <Tabs
          value={editorTab}
          onValueChange={(v) => handleEditorTabChange({ next: v })}
          className="w-full gap-3"
        >
          <TabsList className="grid h-9 w-full grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
            <TabsTrigger
              value="visual"
              className="gap-2 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-none"
            >
              <LayoutList className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Visual
            </TabsTrigger>
            <TabsTrigger
              value="expression"
              className="gap-2 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-none"
            >
              <Braces className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Expression
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="mt-0 outline-none">
            <div className="space-y-2">
              {/* Row list */}
              {rows.length === 0 && !showAddForm ? (
                <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center leading-relaxed">
                  No categories yet. Add a row for each label the model may return, or switch to Expression to supply
                  JSON from tags.
                </p>
              ) : null}

              {rows.length > 0 ? (
                <WorkflowSchemaRowsSortableList
                  items={rows}
                  onReorder={({ next }) => replaceRows(next)}
                  renderDragOverlay={({ item }) => (
                    <div className="pointer-events-none flex min-w-[240px] items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 shadow-lg">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                        <Tag className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="block truncate font-mono text-sm font-medium text-foreground">
                          {item.label.trim() ? item.label : "Untitled label"}
                        </span>
                      </div>
                    </div>
                  )}
                  renderRow={({
                    item: row,
                    spacingBelow,
                    isDragging,
                    sortableStyle,
                    mergedSortableRef,
                    setActivatorNodeRef,
                    dragAttributes,
                    dragListeners,
                  }) => {
                    const isEditing = editingId === row.id

                    if (isEditing && editDraft) {
                      return (
                        <div
                          ref={mergedSortableRef}
                          style={sortableStyle}
                          className={cn(
                            "min-w-0 rounded-lg",
                            isDragging && "relative z-[1] opacity-[0.35]",
                            spacingBelow && "mb-2",
                          )}
                        >
                          <div className="rounded-lg border border-border bg-muted/15 p-3" role="group" aria-label="Edit category">
                            <div className="flex items-stretch gap-2">
                              <WorkflowSchemaSortableGrip
                                setActivatorNodeRef={setActivatorNodeRef}
                                attributes={dragAttributes}
                                listeners={dragListeners}
                                ariaLabel="Drag to reorder category"
                              />
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="grid min-w-0 w-full grid-cols-1 gap-3">
                                  <div className="min-w-0 w-full space-y-1.5">
                                    <Label htmlFor={`${row.id}-label-edit`}>Label</Label>
                                    <Input
                                      id={`${row.id}-label-edit`}
                                      value={editDraft.label}
                                      onChange={(e) =>
                                        setEditDraft((d) =>
                                          d
                                            ? {
                                                ...d,
                                                label: clipWorkflowFieldKeyInput({ value: e.target.value }),
                                              }
                                            : d,
                                        )
                                      }
                                      placeholder="billing_enquiry"
                                      className="w-full min-w-0 font-mono text-sm"
                                    />
                                  </div>
                                  <div className="min-w-0 w-full space-y-1.5">
                                    <Label htmlFor={`${row.id}-desc-edit`}>Description</Label>
                                    <Textarea
                                      id={`${row.id}-desc-edit`}
                                      value={editDraft.description}
                                      onChange={(e) =>
                                        setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))
                                      }
                                      placeholder="When this category should be chosen…"
                                      rows={3}
                                      className="resize-none text-sm leading-relaxed"
                                    />
                                  </div>
                                </div>
                                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={closeEdit}>
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => saveEdit({ id: row.id })}
                                  >
                                    Save category
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        ref={mergedSortableRef}
                        style={sortableStyle}
                        className={cn(
                          "min-w-0 rounded-lg",
                          isDragging && "relative z-[1] opacity-[0.35]",
                          spacingBelow && "mb-2",
                        )}
                      >
                        <div className="group flex min-w-0 w-full items-stretch gap-1 rounded-lg border border-border/70 bg-background focus-within:ring-2 focus-within:ring-ring">
                          <WorkflowSchemaSortableGrip
                            setActivatorNodeRef={setActivatorNodeRef}
                            attributes={dragAttributes}
                            listeners={dragListeners}
                            ariaLabel="Drag to reorder category"
                          />
                          <div className="flex min-w-0 flex-1 items-stretch transition-colors hover:bg-muted/30">
                            <button
                              type="button"
                              onClick={() => openEdit({ row })}
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-3 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-transparent",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              )}
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                                <Tag className="size-4" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <span className="block truncate font-mono text-sm font-medium">
                                  {row.label.trim() ? row.label : "Untitled label"}
                                </span>
                                <p className="truncate text-xs text-muted-foreground">
                                  {row.description.trim() ? row.description : "No description"}
                                </p>
                              </div>
                            </button>
                            {/* Delete — only on row hover / focus-within */}
                            <div
                              className={cn(
                                "flex shrink-0 items-center pr-2 opacity-0 pointer-events-none transition-opacity duration-150",
                                "group-hover:pointer-events-auto group-hover:opacity-100",
                                "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                              )}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault()
                                  removeRow({ id: row.id })
                                }}
                                aria-label={`Remove category ${row.label || row.id}`}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
              ) : null}

              {/* Add category */}
              {!showAddForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    setShowAddForm(true)
                    setAddDraft(emptyAddDraft())
                    closeEdit()
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Add category
                </Button>
              ) : (
                <div className="rounded-lg border border-border bg-muted/15 p-3 space-y-3">
                  <Label className="text-[10px] font-semibold uppercase text-muted-foreground">New category</Label>
                  <div className="grid min-w-0 w-full grid-cols-1 gap-3">
                    <div className="min-w-0 w-full space-y-1.5">
                      <Label htmlFor={`${nodeId}-add-classify-label`}>Label</Label>
                      <Input
                        id={`${nodeId}-add-classify-label`}
                        value={addDraft.label}
                        onChange={(e) =>
                          setAddDraft((d) => ({
                            ...d,
                            label: clipWorkflowFieldKeyInput({ value: e.target.value }),
                          }))
                        }
                        placeholder="billing_enquiry"
                        className="w-full min-w-0 font-mono text-sm"
                      />
                    </div>
                    <div className="min-w-0 w-full space-y-1.5">
                      <Label htmlFor={`${nodeId}-add-classify-desc`}>Description</Label>
                      <Textarea
                        id={`${nodeId}-add-classify-desc`}
                        value={addDraft.description}
                        onChange={(e) => setAddDraft((d) => ({ ...d, description: e.target.value }))}
                        placeholder="When this category should be chosen…"
                        rows={3}
                        className="resize-none text-sm leading-relaxed"
                      />
                    </div>
                  </div>
                  <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setShowAddForm(false)
                        setAddDraft(emptyAddDraft())
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => addCategoryFromDraft()}>
                      Save category
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="expression" className="mt-0 space-y-3 outline-none">
            <ExpressionInput
              tags={promptTags}
              value={String(data.classifyLabelsExpression ?? "")}
              onChange={({ value }) => set("classifyLabelsExpression", value)}
              fieldInstanceId={`${nodeId}-classify-labels-expr`}
              rows={10}
              expressionDialogTitle="Label catalogue expression"
              expressionDialogDescription={
                <>
                  Resolve to JSON: an array with objects containing{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">label</code> (or{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">value</code>) plus{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">description</code>, or an object
                  mapping each label to a description string. Combine literals with{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> from
                  the previous step,{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{trigger_inputs.*}}"}</code>{" "}
                  for the original invoke payload, and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{global.*}}"}</code>.
                </>
              }
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Runtime: resolved text must be JSON. Optional fenced code blocks labelled json are stripped before parsing.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
