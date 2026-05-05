"use client"

import * as React from "react"
import { Braces, GripVertical, LayoutList, Plus, Tag, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FunctionInput } from "@/components/workflow/function-input"
import { clipWorkflowFieldKeyInput } from "@/lib/workflows/engine/input-schema"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"
import {
  createEmptyClassifyLabelPersistedRow,
  readClassifyLabelRowsFromNodeData,
  type ClassifyLabelRowPersisted,
} from "@/lib/workflows/steps/ai/classify/defaults"

/** MIME type for HTML5 drag payloads between catalogue rows. */
const CLASSIFY_LABEL_DRAG_MIME = "application/x-runnerroo-classify-label-id"

export interface ClassifyCatalogueEditorProps {
  data: Record<string, unknown>
  set: (key: string, value: unknown) => void
  nodeId: string
  promptTags: PromptTagDefinition[]
}

interface ClassifyLabelDragHandleProps {
  rowId: string
  onDragStartRow: ({ id }: { id: string }) => void
  onDragEndRow: () => void
}

/**
 * Grip control for reordering classifier catalogue rows (same interaction model as the input schema editor).
 */
function ClassifyLabelDragHandle({ rowId, onDragStartRow, onDragEndRow }: ClassifyLabelDragHandleProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-8 shrink-0 cursor-default touch-none items-center justify-center self-stretch border-0 bg-transparent p-0",
        "text-muted-foreground hover:cursor-ns-resize hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      draggable
      aria-label="Drag to reorder category"
      onDragStart={(e) => {
        e.dataTransfer.setData(CLASSIFY_LABEL_DRAG_MIME, rowId)
        e.dataTransfer.effectAllowed = "move"
        onDragStartRow({ id: rowId })
      }}
      onDragEnd={onDragEndRow}
    >
      <GripVertical className="pointer-events-none size-4 shrink-0" aria-hidden />
    </button>
  )
}

interface ReorderClassifyLabelRowsParams {
  rows: ClassifyLabelRowPersisted[]
  activeId: string
  overId: string
}

/**
 * Moves the row identified by `activeId` to the index of `overId`.
 */
function reorderClassifyLabelRows({ rows, activeId, overId }: ReorderClassifyLabelRowsParams): ClassifyLabelRowPersisted[] {
  if (activeId === overId) return rows
  const fromIdx = rows.findIndex((r) => r.id === activeId)
  const toIdx = rows.findIndex((r) => r.id === overId)
  if (fromIdx === -1 || toIdx === -1) return rows
  const next = [...rows]
  const [moved] = next.splice(fromIdx, 1)
  if (!moved) return rows
  let insertAt = toIdx
  if (fromIdx < toIdx) insertAt = toIdx - 1
  next.splice(insertAt, 0, moved)
  return next
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

  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)
  const draggingIdRef = React.useRef<string | null>(null)

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

  function handleFieldDragStart({ id }: { id: string }) {
    draggingIdRef.current = id
    setDraggingId(id)
  }

  function handleFieldDragEnd() {
    draggingIdRef.current = null
    setDraggingId(null)
    setDragOverId(null)
  }

  function handleRowDragOver({
    e,
    targetRowId,
  }: {
    e: React.DragEvent
    targetRowId: string
  }) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const fromId = draggingIdRef.current ?? draggingId
    if (fromId && fromId !== targetRowId) setDragOverId(targetRowId)
  }

  function handleRowDrop({
    e,
    targetRowId,
  }: {
    e: React.DragEvent
    targetRowId: string
  }) {
    e.preventDefault()
    const fromId =
      e.dataTransfer.getData(CLASSIFY_LABEL_DRAG_MIME) || draggingIdRef.current || draggingId || ""
    if (!fromId || fromId === targetRowId) {
      handleFieldDragEnd()
      return
    }
    replaceRows(reorderClassifyLabelRows({ rows, activeId: fromId, overId: targetRowId }))
    handleFieldDragEnd()
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
        "min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40 shadow-sm",
      )}
    >
      {/* Panel header — matches InputSchemaBuilder */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background shadow-sm"
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
              className="gap-2 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <LayoutList className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Visual
            </TabsTrigger>
            <TabsTrigger
              value="expression"
              className="gap-2 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
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

              {rows.map((row) => {
                const isEditing = editingId === row.id

                if (isEditing && editDraft) {
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "min-w-0 rounded-lg transition-opacity",
                        draggingId === row.id && "opacity-55",
                        dragOverId === row.id &&
                          draggingId != null &&
                          draggingId !== row.id &&
                          "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
                      )}
                      onDragOver={(e) => handleRowDragOver({ e, targetRowId: row.id })}
                      onDrop={(e) => handleRowDrop({ e, targetRowId: row.id })}
                    >
                      <div className="rounded-lg border border-border bg-muted/15 p-3" role="group" aria-label="Edit category">
                        <div className="flex items-stretch gap-2">
                          <ClassifyLabelDragHandle
                            rowId={row.id}
                            onDragStartRow={handleFieldDragStart}
                            onDragEndRow={handleFieldDragEnd}
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
                    key={row.id}
                    className={cn(
                      "min-w-0 rounded-lg transition-opacity",
                      draggingId === row.id && "opacity-55",
                      dragOverId === row.id &&
                        draggingId != null &&
                        draggingId !== row.id &&
                        "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
                    )}
                    onDragOver={(e) => handleRowDragOver({ e, targetRowId: row.id })}
                    onDrop={(e) => handleRowDrop({ e, targetRowId: row.id })}
                  >
                    <div className="group flex min-w-0 w-full items-stretch gap-1 rounded-lg border border-border/70 bg-background focus-within:ring-2 focus-within:ring-ring">
                      <ClassifyLabelDragHandle
                        rowId={row.id}
                        onDragStartRow={handleFieldDragStart}
                        onDragEndRow={handleFieldDragEnd}
                      />
                      <button
                        type="button"
                        onClick={() => openEdit({ row })}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-auto min-h-0 w-8 shrink-0 self-stretch text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                )
              })}

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
            <FunctionInput
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
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev.*}}"}</code>,{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code>, and{" "}
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
