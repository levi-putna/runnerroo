"use client"

import * as React from "react"
import { AlignLeft, GripVertical, Hash, Plus, ScanSearch, ToggleLeft, Trash2, Type } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { clipWorkflowFieldKeyInput, labelToDefaultKey } from "@/lib/workflows/engine/input-schema"
import {
  EXTRACT_FIELD_TYPES,
  type ExtractFieldRow,
  type ExtractFieldType,
  createEmptyExtractFieldRow,
  readExtractFieldRowsFromNodeData,
} from "@/lib/workflows/steps/ai/extract/defaults"

/** MIME type for HTML5 drag payloads between extract field rows. */
const EXTRACT_FIELD_DRAG_MIME = "application/x-runnerroo-extract-field-id"

const EXTRACT_TYPE_META: Record<ExtractFieldType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  string: { label: "String", Icon: Type },
  text: { label: "Text", Icon: AlignLeft },
  number: { label: "Number", Icon: Hash },
  boolean: { label: "Boolean", Icon: ToggleLeft },
}

export interface ExtractFieldsEditorProps {
  data: Record<string, unknown>
  set: (key: string, value: unknown) => void
  nodeId: string
}

interface DraftRow {
  key: string
  label: string
  type: ExtractFieldType
  required: boolean
  description: string
  keyTouched: boolean
}

function emptyDraft(): DraftRow {
  return { key: "", label: "", type: "string", required: false, description: "", keyTouched: false }
}

function draftFromRow({ row }: { row: ExtractFieldRow }): DraftRow {
  return {
    key: row.key,
    label: row.label,
    type: row.type,
    required: row.required,
    description: row.description,
    keyTouched: false,
  }
}

interface ExtractFieldDragHandleProps {
  rowId: string
  onDragStartRow: ({ id }: { id: string }) => void
  onDragEndRow: () => void
}

/**
 * Grip control for reordering extract field rows.
 */
function ExtractFieldDragHandle({ rowId, onDragStartRow, onDragEndRow }: ExtractFieldDragHandleProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-8 shrink-0 cursor-default touch-none items-center justify-center self-stretch border-0 bg-transparent p-0",
        "text-muted-foreground hover:cursor-ns-resize hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      draggable
      aria-label="Drag to reorder field"
      onDragStart={(e) => {
        e.dataTransfer.setData(EXTRACT_FIELD_DRAG_MIME, rowId)
        e.dataTransfer.effectAllowed = "move"
        onDragStartRow({ id: rowId })
      }}
      onDragEnd={onDragEndRow}
    >
      <GripVertical className="pointer-events-none size-4 shrink-0" aria-hidden />
    </button>
  )
}

function reorderExtractFieldRows({
  rows,
  activeId,
  overId,
}: {
  rows: ExtractFieldRow[]
  activeId: string
  overId: string
}): ExtractFieldRow[] {
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

/**
 * Visual field list editor for Extract steps — same card shell and row UX as the schema builder.
 * Each row defines one value the model must find and return in the structured output.
 */
export function ExtractFieldsEditor({ data, set, nodeId }: ExtractFieldsEditorProps) {
  const rows = readExtractFieldRowsFromNodeData({ value: data.extractFields })

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState<DraftRow | null>(null)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [addDraft, setAddDraft] = React.useState<DraftRow>(() => emptyDraft())

  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)
  const draggingIdRef = React.useRef<string | null>(null)

  function replaceRows(next: ExtractFieldRow[]) {
    set("extractFields", next)
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

  function handleRowDragOver({ e, targetRowId }: { e: React.DragEvent; targetRowId: string }) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const fromId = draggingIdRef.current ?? draggingId
    if (fromId && fromId !== targetRowId) setDragOverId(targetRowId)
  }

  function handleRowDrop({ e, targetRowId }: { e: React.DragEvent; targetRowId: string }) {
    e.preventDefault()
    const fromId = e.dataTransfer.getData(EXTRACT_FIELD_DRAG_MIME) || draggingIdRef.current || draggingId || ""
    if (!fromId || fromId === targetRowId) {
      handleFieldDragEnd()
      return
    }
    replaceRows(reorderExtractFieldRows({ rows, activeId: fromId, overId: targetRowId }))
    handleFieldDragEnd()
  }

  function openEdit({ row }: { row: ExtractFieldRow }) {
    setShowAddForm(false)
    setAddDraft(emptyDraft())
    setEditingId(row.id)
    setEditDraft(draftFromRow({ row }))
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
              key: clipWorkflowFieldKeyInput({ value: editDraft.key }),
              label: editDraft.label.trim() || clipWorkflowFieldKeyInput({ value: editDraft.key }),
              type: editDraft.type,
              required: editDraft.required,
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

  function addRowFromDraft() {
    const key = clipWorkflowFieldKeyInput({ value: addDraft.key || labelToDefaultKey({ label: addDraft.label }) || "field" })
    const label = addDraft.label.trim() || key
    const row = createEmptyExtractFieldRow({
      partial: { key, label, type: addDraft.type, required: addDraft.required, description: addDraft.description.trim() },
    })
    replaceRows([...rows, row])
    setAddDraft(emptyDraft())
    setShowAddForm(false)
  }

  return (
    <div className={cn("min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40 shadow-sm")}>
      {/* Panel header — mirrors InputSchemaBuilder */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background shadow-sm"
          aria-hidden
        >
          <ScanSearch className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">Extraction fields</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each row defines a value the model must locate and return. The key becomes{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{exe.<key>}}"}</code> in the Output
            schema.
          </p>
        </div>
      </div>

      <div className="space-y-2 px-4 pb-4 pt-3">
        {/* Empty state */}
        {rows.length === 0 && !showAddForm ? (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center leading-relaxed">
            No fields yet. Add a row for each value you want the model to extract from the content.
          </p>
        ) : null}

        {/* Field list */}
        {rows.map((row) => {
          const meta = EXTRACT_TYPE_META[row.type]
          const Icon = meta.Icon
          const isEditing = editingId === row.id

          if (isEditing && editDraft) {
            return (
              <div
                key={row.id}
                className={cn(
                  "min-w-0 rounded-lg transition-opacity",
                  draggingId === row.id && "opacity-55",
                  dragOverId === row.id && draggingId != null && draggingId !== row.id &&
                    "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
                )}
                onDragOver={(e) => handleRowDragOver({ e, targetRowId: row.id })}
                onDrop={(e) => handleRowDrop({ e, targetRowId: row.id })}
              >
                <div className="rounded-lg border border-border bg-muted/15 p-3" role="group" aria-label="Edit field">
                  <div className="flex items-stretch gap-2">
                    <ExtractFieldDragHandle
                      rowId={row.id}
                      onDragStartRow={handleFieldDragStart}
                      onDragEndRow={handleFieldDragEnd}
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                        {/* Key */}
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                          <Label htmlFor={`${nodeId}-edit-key-${row.id}`}>Key</Label>
                          <Input
                            id={`${nodeId}-edit-key-${row.id}`}
                            value={editDraft.key}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, key: clipWorkflowFieldKeyInput({ value: e.target.value }), keyTouched: true } : d,
                              )
                            }
                            placeholder="invoice_number"
                            className="w-full min-w-0 font-mono text-sm"
                          />
                        </div>
                        {/* Label */}
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                          <Label htmlFor={`${nodeId}-edit-label-${row.id}`}>Label</Label>
                          <Input
                            id={`${nodeId}-edit-label-${row.id}`}
                            value={editDraft.label}
                            onChange={(e) => {
                              const label = e.target.value
                              setEditDraft((d) => {
                                if (!d) return d
                                const derived = labelToDefaultKey({ label })
                                const nextKey = d.keyTouched ? d.key : derived || d.key
                                return { ...d, label, key: nextKey }
                              })
                            }}
                            placeholder="Invoice number"
                            className="w-full min-w-0"
                          />
                        </div>
                        {/* Type */}
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                          <Label htmlFor={`${nodeId}-edit-type-${row.id}`}>Type</Label>
                          <Select
                            value={editDraft.type}
                            onValueChange={(v) =>
                              setEditDraft((d) => (d ? { ...d, type: v as ExtractFieldType } : d))
                            }
                          >
                            <SelectTrigger id={`${nodeId}-edit-type-${row.id}`} className="w-full min-w-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EXTRACT_FIELD_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {EXTRACT_TYPE_META[t].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Required toggle */}
                        <div className="flex min-h-8 w-full min-w-0 flex-col gap-2 sm:col-span-1 sm:flex-row sm:items-center sm:justify-between">
                          <Label htmlFor={`${nodeId}-edit-req-${row.id}`} className="shrink-0 font-normal">
                            Required
                          </Label>
                          <Switch
                            id={`${nodeId}-edit-req-${row.id}`}
                            checked={editDraft.required}
                            onCheckedChange={(checked) =>
                              setEditDraft((d) => (d ? { ...d, required: checked } : d))
                            }
                            className="shrink-0"
                          />
                        </div>
                        {/* Description — full width */}
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`${nodeId}-edit-desc-${row.id}`}>
                            Description
                          </Label>
                          <Textarea
                            id={`${nodeId}-edit-desc-${row.id}`}
                            value={editDraft.description}
                            onChange={(e) =>
                              setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))
                            }
                            placeholder="What to look for and where — the model uses this to locate the value."
                            rows={3}
                            className="resize-none text-sm leading-relaxed"
                          />
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Be specific: mention the field name, format, and location in the source where possible.
                          </p>
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
                          Save field
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
                dragOverId === row.id && draggingId != null && draggingId !== row.id &&
                  "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
              )}
              onDragOver={(e) => handleRowDragOver({ e, targetRowId: row.id })}
              onDrop={(e) => handleRowDrop({ e, targetRowId: row.id })}
            >
              <div className="group flex min-w-0 w-full items-stretch gap-1 rounded-lg border border-border/70 bg-background focus-within:ring-2 focus-within:ring-ring">
                <ExtractFieldDragHandle
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
                  {/* Type icon */}
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {/* Key + label + badges */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium">{row.key || "—"}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                        {meta.label}
                      </Badge>
                      {row.required ? (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                          Required
                        </Badge>
                      ) : null}
                    </div>
                    {row.label !== row.key ? (
                      <p className="truncate text-xs text-muted-foreground">{row.label}</p>
                    ) : null}
                    {row.description ? (
                      <p className="truncate text-[11px] text-muted-foreground">{row.description}</p>
                    ) : null}
                  </div>
                </button>
                {/* Delete */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-auto min-h-0 w-8 shrink-0 self-stretch text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault()
                    removeRow({ id: row.id })
                  }}
                  aria-label={`Remove field ${row.key || row.id}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          )
        })}

        {/* Add field toggle / form */}
        {!showAddForm ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => {
              setShowAddForm(true)
              setAddDraft(emptyDraft())
              closeEdit()
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add field
          </Button>
        ) : (
          <div className="rounded-lg border border-border bg-muted/15 p-3 space-y-3">
            <Label className="text-[10px] font-semibold uppercase text-muted-foreground">New field</Label>
            <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Key */}
              <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                <Label htmlFor={`${nodeId}-add-extract-key`}>Key</Label>
                <Input
                  id={`${nodeId}-add-extract-key`}
                  value={addDraft.key}
                  onChange={(e) =>
                    setAddDraft((d) => ({
                      ...d,
                      key: clipWorkflowFieldKeyInput({ value: e.target.value }),
                      keyTouched: true,
                    }))
                  }
                  placeholder="invoice_number"
                  className="w-full min-w-0 font-mono text-sm"
                />
              </div>
              {/* Label */}
              <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                <Label htmlFor={`${nodeId}-add-extract-label`}>Label</Label>
                <Input
                  id={`${nodeId}-add-extract-label`}
                  value={addDraft.label}
                  onChange={(e) => {
                    const label = e.target.value
                    setAddDraft((d) => {
                      const nextKey = d.keyTouched ? d.key : labelToDefaultKey({ label }) || d.key
                      return { ...d, label, key: nextKey }
                    })
                  }}
                  placeholder="Invoice number"
                  className="w-full min-w-0"
                />
              </div>
              {/* Type */}
              <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                <Label htmlFor={`${nodeId}-add-extract-type`}>Type</Label>
                <Select
                  value={addDraft.type}
                  onValueChange={(v) => setAddDraft((d) => ({ ...d, type: v as ExtractFieldType }))}
                >
                  <SelectTrigger id={`${nodeId}-add-extract-type`} className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTRACT_FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EXTRACT_TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Required toggle */}
              <div className="flex min-h-8 w-full min-w-0 flex-col gap-2 sm:col-span-1 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor={`${nodeId}-add-extract-req`} className="shrink-0 font-normal">
                  Required
                </Label>
                <Switch
                  id={`${nodeId}-add-extract-req`}
                  checked={addDraft.required}
                  onCheckedChange={(checked) => setAddDraft((d) => ({ ...d, required: checked }))}
                  className="shrink-0"
                />
              </div>
              {/* Description */}
              <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                <Label htmlFor={`${nodeId}-add-extract-desc`}>Description</Label>
                <Textarea
                  id={`${nodeId}-add-extract-desc`}
                  value={addDraft.description}
                  onChange={(e) => setAddDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="What to look for and where — the model uses this to locate the value."
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
                  setAddDraft(emptyDraft())
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => addRowFromDraft()}>
                Save field
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
