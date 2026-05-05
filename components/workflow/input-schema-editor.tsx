"use client"

import * as React from "react"
import { AlignLeft, GripVertical, Hash, Plus, ToggleLeft, Trash2, Type } from "lucide-react"
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
import type { NodeInputField, NodeInputFieldType } from "@/lib/workflows/engine/input-schema"
import {
  clipWorkflowFieldKeyInput,
  createEmptyNodeInputField,
  labelToDefaultKey,
  sanitiseInputFieldKey,
} from "@/lib/workflows/engine/input-schema"
import { mergePromptTagDefinitions, type PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"
import { FunctionInput } from "@/components/workflow/function-input"

const TYPE_META: Record<
  NodeInputFieldType,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  string: { label: "String", Icon: Type },
  text: { label: "Text", Icon: AlignLeft },
  number: { label: "Number", Icon: Hash },
  boolean: { label: "Boolean", Icon: ToggleLeft },
}

export interface InputSchemaEditorProps {
  fields: NodeInputField[]
  onChange: ({ fields }: { fields: NodeInputField[] }) => void
  /** Where the user will reference `{{input.*}}` — adjusts the hint copy. */
  usageContext?: "prompt" | "code" | "trigger" | "output" | "globals"
  /** When false, hides the outer section heading when composed inside a parent schema editor shell. */
  showHeader?: boolean
  /** Inbound predecessor output tags (`prev`, `prev.text`, …) for mapping cell autocomplete. */
  upstreamPromptTags?: PromptTagDefinition[]
  /** Extra contextual tags merged after upstream tags (for example `{{exe.*}}` execution outputs). */
  contextualPromptTags?: PromptTagDefinition[]
}

interface DraftField {
  key: string
  label: string
  type: NodeInputFieldType
  required: boolean
  description: string
  /** Matches {@link NodeInputField.value} (literals or `{{…}}` tags). */
  value: string
  keyTouched: boolean
}

function emptyDraft(): DraftField {
  return {
    key: "",
    label: "",
    type: "string",
    required: false,
    description: "",
    value: "",
    keyTouched: false,
  }
}

function draftFromField({ field }: { field: NodeInputField }): DraftField {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    description: field.description ?? "",
    value: field.value ?? "",
    keyTouched: false,
  }
}

/** MIME type for HTML5 drag payloads between schema field rows. */
const INPUT_SCHEMA_FIELD_DRAG_MIME = "application/x-runnerroo-input-field-id"

interface InputSchemaDragHandleProps {
  fieldId: string
  onDragStartField: ({ id }: { id: string }) => void
  onDragEndField: () => void
}

/**
 * Grip control that starts a native drag–reorder for the owning field row.
 */
function InputSchemaDragHandle({
  fieldId,
  onDragStartField,
  onDragEndField,
}: InputSchemaDragHandleProps) {
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
        e.dataTransfer.setData(INPUT_SCHEMA_FIELD_DRAG_MIME, fieldId)
        e.dataTransfer.effectAllowed = "move"
        onDragStartField({ id: fieldId })
      }}
      onDragEnd={onDragEndField}
    >
      <GripVertical className="pointer-events-none size-4 shrink-0" aria-hidden />
    </button>
  )
}

interface ReorderInputSchemaFieldsParams {
  fields: NodeInputField[]
  activeId: string
  overId: string
}

/**
 * Moves the field identified by `activeId` to the index of `overId` within the list.
 */
function reorderInputSchemaFields({
  fields,
  activeId,
  overId,
}: ReorderInputSchemaFieldsParams): NodeInputField[] {
  if (activeId === overId) return fields
  const fromIdx = fields.findIndex((f) => f.id === activeId)
  const toIdx = fields.findIndex((f) => f.id === overId)
  if (fromIdx === -1 || toIdx === -1) return fields
  const next = [...fields]
  const [moved] = next.splice(fromIdx, 1)
  if (!moved) return fields
  let insertAt = toIdx
  if (fromIdx < toIdx) insertAt = toIdx - 1
  next.splice(insertAt, 0, moved)
  return next
}

/** Sentinel id while the “add field” draft has no persisted row yet — sibling tags include every saved row. */
const SCHEMA_ADD_FIELD_ROW_ID = "__schema-add-draft__"

interface SchemaValueFunctionInputProps {
  /** Stable row id or {@link SCHEMA_ADD_FIELD_ROW_ID} for the add form. */
  fieldId: string
  fields: NodeInputField[]
  /** Tags for the inbound predecessor (`{{prev.*}}`). */
  upstreamPromptTags?: PromptTagDefinition[]
  /** Tags merged after upstream tags — execution outputs (`{{exe.*}}`), declared inputs to reuse as expressions, etc. */
  contextualPromptTags?: PromptTagDefinition[]
  /** When `globals`, value editor copy targets workflow global tag expressions. */
  expressionMode?: "standard" | "globals"
  value: string
  onChange: ({ value }: { value: string }) => void
  placeholder: string
  rows?: number
  /** Associates the editor surface with a visible {@link Label} via `htmlFor`. */
  id?: string
}

/**
 * Schema field default value editor: literals plus globals, inbound `prev.*`, and sibling `{{input.*}}` tags.
 */
function SchemaValueFunctionInput({
  fieldId,
  fields,
  upstreamPromptTags = [],
  contextualPromptTags = [],
  expressionMode = "standard",
  value,
  onChange,
  placeholder,
  rows = 2,
  id,
}: SchemaValueFunctionInputProps) {
  const contextualTags = React.useMemo((): PromptTagDefinition[] => {
    const sibling = fields
      .filter((f) => f.id !== fieldId)
      .map((f) => {
        const token = `input.${f.key}`
        return {
          id: token,
          label: f.label?.trim() || f.key,
          description:
            f.description?.trim() ||
            `Sibling input “${f.label || f.key}” on this step (resolved earlier when chaining evaluates sibling tags).`,
        }
      })
    return [...upstreamPromptTags, ...contextualPromptTags, ...sibling]
  }, [fields, fieldId, upstreamPromptTags, contextualPromptTags])

  const mergedTags = React.useMemo(
    () => mergePromptTagDefinitions({ contextual: contextualTags }),
    [contextualTags],
  )

  const expressionDialogDescription =
    expressionMode === "globals"
      ? "Each row writes one key on the run-wide globals map ({{global.this_key}} for later nodes). Use the same tags as the Output schema above: {{input.*}} (Input tab and output row keys on AI steps), {{prev.*}} inbound, {{exe.*}} after the model runs, incoming {{global.*}} from earlier steps, and {{now.*}}. Rows on this tab only see incoming globals, not other rows on this tab. Resolution order is defined by the runner."
      : contextualPromptTags.length > 0
        ? "Mix literals with workflow tags — {{exe.*}} values come from this step’s AI execution result (tokens, model id, assistant text). Combine with {{prev.*}} from upstream, sibling rows as {{input.other_field}}, globals {{now.iso}}, etc. Resolution order is defined by the runner."
        : "Mix literals with workflow tags — for example {{now.iso}}, {{prev.text}} from the inbound step, or sibling inputs {{input.other_field}}. Boolean rows accept true/false literals or tags that resolve to booleans at runtime. Resolution order is defined by the runner."

  return (
    <FunctionInput
      tags={mergedTags}
      value={value}
      onChange={onChange}
      fieldInstanceId={`schema-value-${fieldId}`}
      id={id}
      placeholder={placeholder}
      rows={rows}
      expressionDialogTitle="Value"
      expressionDialogDescription={expressionDialogDescription}
      className="bg-background"
    />
  )
}

/** Returns a trimmed schema value string for persistence, or undefined when empty. */
function persistSchemaFieldValue({ value }: { value: string }): string | undefined {
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/**
 * Placeholder copy for the tagged value control, keyed by field type.
 */
function schemaValuePlaceholderForType({ type }: { type: NodeInputFieldType }): string {
  if (type === "boolean") return "true, false, {{input.some_flag}}, or {{prev.text}}"
  if (type === "number") return "0, {{now.unix_ms}}, or {{prev.age}}"
  if (type === "text") return "Fallback text or {{now.iso}}"
  return "Fallback — literals or tags"
}

/**
 * Row count for the tagged value editor; long-form `text` gets an extra line.
 */
function schemaValueRowsForType({ type }: { type: NodeInputFieldType }): number {
  return type === "text" ? 3 : 2
}

/**
 * Reusable editor: declare typed input fields for a workflow step.
 * Persists as an array on `node.data.inputSchema`; reference in prompts or code via `{{input.key}}`.
 */
export function InputSchemaEditor({
  fields,
  onChange,
  usageContext = "prompt",
  showHeader = true,
  upstreamPromptTags = [],
  contextualPromptTags = [],
}: InputSchemaEditorProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [addDraft, setAddDraft] = React.useState<DraftField>(() => emptyDraft())
  const [editDraft, setEditDraft] = React.useState<DraftField | null>(null)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)
  const draggingIdRef = React.useRef<string | null>(null)

  function commitFields({ next }: { next: NodeInputField[] }) {
    onChange({ fields: next })
  }

  function removeField({ id }: { id: string }) {
    commitFields({ next: fields.filter((f) => f.id !== id) })
    if (editingId === id) {
      setEditingId(null)
      setEditDraft(null)
    }
  }

  function openEdit({ field }: { field: NodeInputField }) {
    setEditingId(field.id)
    setEditDraft(draftFromField({ field }))
  }

  function closeEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  /** Records which field row is being dragged (HTML5 DnD). */
  function handleFieldDragStart({ id }: { id: string }) {
    draggingIdRef.current = id
    setDraggingId(id)
  }

  function handleFieldDragEnd() {
    draggingIdRef.current = null
    setDraggingId(null)
    setDragOverId(null)
  }

  /** Allows dropping onto another row to insert at that row’s position. */
  function handleRowDragOver({
    e,
    targetFieldId,
  }: {
    e: React.DragEvent
    targetFieldId: string
  }) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const fromId = draggingIdRef.current ?? draggingId
    if (fromId && fromId !== targetFieldId) setDragOverId(targetFieldId)
  }

  /** Reorders `fields` when a row is dropped onto another row. */
  function handleRowDrop({
    e,
    targetFieldId,
  }: {
    e: React.DragEvent
    targetFieldId: string
  }) {
    e.preventDefault()
    const fromId =
      e.dataTransfer.getData(INPUT_SCHEMA_FIELD_DRAG_MIME) || draggingIdRef.current || draggingId || ""
    if (!fromId || fromId === targetFieldId) {
      handleFieldDragEnd()
      return
    }
    commitFields({
      next: reorderInputSchemaFields({ fields, activeId: fromId, overId: targetFieldId }),
    })
    handleFieldDragEnd()
  }

  function addFieldFromDraft({ draft }: { draft: DraftField }) {
    const key = sanitiseInputFieldKey({ key: draft.key || labelToDefaultKey({ label: draft.label }) || "field" })
    const label = draft.label.trim() || key
    const nextField = createEmptyNodeInputField({
      partial: {
        key,
        label,
        type: draft.type,
        required: draft.required,
        description: draft.description.trim() || undefined,
        value: persistSchemaFieldValue({
          value: draft.value,
        }),
      },
    })
    commitFields({ next: [...fields, nextField] })
    setAddDraft(emptyDraft())
    setShowAddForm(false)
  }

  function saveEdit({ id }: { id: string }) {
    if (!editDraft) return
    const key = sanitiseInputFieldKey({ key: editDraft.key || labelToDefaultKey({ label: editDraft.label }) || "field" })
    const label = editDraft.label.trim() || key
    const next = fields.map((f) =>
      f.id === id
        ? {
            ...f,
            key,
            label,
            type: editDraft.type,
            required: editDraft.required,
            description: editDraft.description.trim() || undefined,
            value: persistSchemaFieldValue({
              value: editDraft.value,
            }),
          }
        : f,
    )
    commitFields({ next })
    closeEdit()
  }

  const hintTarget = usageContext === "code" ? "code" : "prompt"

  return (
    <div className="min-w-0 w-full space-y-4">
      {/* Section title */}
      {showHeader ? (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {usageContext === "globals" ? "Global tags" : "Input fields"}
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {usageContext === "trigger"
              ? "Describe the payload keys this trigger exposes (for example webhook JSON properties). Downstream steps reference these keys via tags."
              : usageContext === "code"
                ? "Declare the variables this step receives at runtime; they become `input` in your code. Use tag expressions such as {{input.other_key}}."
                : usageContext === "output"
                  ? "Outbound keys forwarded after a manual run. Align them with the Input tab payload so downstream placeholders stay consistent."
                  : usageContext === "globals"
                    ? "Each key becomes {{global.key}} for any downstream step. Omit this section when you do not need shared state across the graph."
                    : "Declare the variables this step receives at runtime. Use tag expressions such as {{input.other_key}} or {{now.iso}}."}
          </p>
        </div>
      ) : null}

      {/* Field list */}
      <div className="space-y-2">
        {fields.length === 0 && !showAddForm ? (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center">
            {usageContext === "globals"
              ? "No workflow globals yet. Add a tag name and expression — later steps read values as {{global.tag_key}}."
              : "No input fields yet. Add a field to shape the object this step expects."}
          </p>
        ) : null}

        {fields.map((field) => {
          const meta = TYPE_META[field.type]
          const Icon = meta.Icon
          const isEditing = editingId === field.id

          if (isEditing && editDraft) {
            return (
              <div
                key={field.id}
                className={cn(
                  "min-w-0 rounded-lg transition-opacity",
                  draggingId === field.id && "opacity-55",
                  dragOverId === field.id &&
                    draggingId != null &&
                    draggingId !== field.id &&
                    "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
                )}
                onDragOver={(e) => handleRowDragOver({ e, targetFieldId: field.id })}
                onDrop={(e) => handleRowDrop({ e, targetFieldId: field.id })}
              >
                <div
                  className="rounded-lg border border-border bg-muted/15 p-3"
                  role="group"
                  aria-label={`Edit field ${field.label}`}
                >
                  <div className="flex items-stretch gap-2">
                    {/* Drag handle */}
                    <InputSchemaDragHandle
                      fieldId={field.id}
                      onDragStartField={handleFieldDragStart}
                      onDragEndField={handleFieldDragEnd}
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                    <Label htmlFor={`edit-key-${field.id}`}>Key</Label>
                    <Input
                      id={`edit-key-${field.id}`}
                      value={editDraft.key}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d
                            ? {
                                ...d,
                                key: clipWorkflowFieldKeyInput({ value: e.target.value }),
                                keyTouched: true,
                              }
                            : d,
                        )
                      }
                      placeholder="customer_name or api-key"
                      className="w-full min-w-0 font-mono text-sm"
                    />
                  </div>
                  <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                    <Label htmlFor={`edit-label-${field.id}`}>Label</Label>
                    <Input
                      id={`edit-label-${field.id}`}
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
                      placeholder="Customer name"
                      className="w-full min-w-0"
                    />
                  </div>
                  <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                    <Label htmlFor={`edit-type-${field.id}`}>Type</Label>
                    <Select
                      value={editDraft.type}
                      onValueChange={(v) =>
                        setEditDraft((d) => (d ? { ...d, type: v as NodeInputFieldType } : d))
                      }
                    >
                      <SelectTrigger id={`edit-type-${field.id}`} className="w-full min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_META) as NodeInputFieldType[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_META[t].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-h-8 w-full min-w-0 flex-col gap-2 sm:col-span-1 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor={`edit-req-${field.id}`} className="shrink-0 font-normal">
                      Required
                    </Label>
                    <Switch
                      id={`edit-req-${field.id}`}
                      checked={editDraft.required}
                      onCheckedChange={(checked) =>
                        setEditDraft((d) => (d ? { ...d, required: checked } : d))
                      }
                      className="shrink-0"
                    />
                  </div>
                  {/* Value — tagged for all primitive types */}
                  <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`edit-schema-value-${field.id}`} className="font-normal">
                      Value
                    </Label>
                    <SchemaValueFunctionInput
                      fieldId={field.id}
                      fields={fields}
                      upstreamPromptTags={upstreamPromptTags}
                      contextualPromptTags={contextualPromptTags}
                      expressionMode={usageContext === "globals" ? "globals" : "standard"}
                      id={`edit-schema-value-${field.id}`}
                      value={editDraft.value}
                      onChange={({ value }) =>
                        setEditDraft((d) => (d ? { ...d, value: value ?? "" } : d))
                      }
                      placeholder={schemaValuePlaceholderForType({ type: editDraft.type })}
                      rows={schemaValueRowsForType({ type: editDraft.type })}
                    />
                  </div>
                  <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`edit-desc-${field.id}`} className="font-normal">
                      Description
                    </Label>
                    <Textarea
                      id={`edit-desc-${field.id}`}
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                      placeholder="Shown as help text in the runner"
                      rows={2}
                      className="w-full min-w-0 resize-none text-sm leading-relaxed"
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
                    onClick={() => saveEdit({ id: field.id })}
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
              key={field.id}
              className={cn(
                "min-w-0 rounded-lg transition-opacity",
                draggingId === field.id && "opacity-55",
                dragOverId === field.id &&
                  draggingId != null &&
                  draggingId !== field.id &&
                  "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
              )}
              onDragOver={(e) => handleRowDragOver({ e, targetFieldId: field.id })}
              onDrop={(e) => handleRowDrop({ e, targetFieldId: field.id })}
            >
              <div className="group flex min-w-0 w-full items-stretch gap-1 rounded-lg border border-border/70 bg-background focus-within:ring-2 focus-within:ring-ring">
                {/* Drag handle */}
                <InputSchemaDragHandle
                  fieldId={field.id}
                  onDragStartField={handleFieldDragStart}
                  onDragEndField={handleFieldDragEnd}
                />
                <button
                  type="button"
                  onClick={() => openEdit({ field })}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
              {/* Type icon */}
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              {/* Key + label */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium">{field.key}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                    {meta.label}
                  </Badge>
                  {field.required ? (
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      Required
                    </Badge>
                  ) : null}
                </div>
                {field.label !== field.key ? (
                  <p className="truncate text-xs text-muted-foreground">{field.label}</p>
                ) : null}
                {field.value !== undefined && field.value !== "" ? (
                  <p className="truncate text-[11px] font-mono text-muted-foreground">
                    Value: {field.value}
                  </p>
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
                  removeField({ id: field.id })
                }}
                aria-label={`Remove field ${field.key}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add field: toggle + inline form */}
      {!showAddForm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => {
            setShowAddForm(true)
            setAddDraft(emptyDraft())
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add field
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-muted/15 p-3 space-y-3">
          {/* Add form */}
          <Label className="text-[10px] font-semibold uppercase text-muted-foreground">New field</Label>
          <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
              <Label htmlFor="add-schema-key">Key</Label>
              <Input
                id="add-schema-key"
                value={addDraft.key}
                onChange={(e) =>
                  setAddDraft((d) => ({
                    ...d,
                    key: clipWorkflowFieldKeyInput({ value: e.target.value }),
                    keyTouched: true,
                  }))
                }
                placeholder="customer_name or api-key"
                className="w-full min-w-0 font-mono text-sm"
              />
            </div>
            <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
              <Label htmlFor="add-schema-label">Label</Label>
              <Input
                id="add-schema-label"
                value={addDraft.label}
                onChange={(e) => {
                  const label = e.target.value
                  setAddDraft((d) => {
                    const nextKey = d.keyTouched ? d.key : labelToDefaultKey({ label }) || d.key
                    return { ...d, label, key: nextKey }
                  })
                }}
                placeholder="Customer name"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
              <Label htmlFor="add-schema-type">Type</Label>
              <Select
                value={addDraft.type}
                onValueChange={(v) => setAddDraft((d) => ({ ...d, type: v as NodeInputFieldType }))}
              >
                <SelectTrigger id="add-schema-type" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as NodeInputFieldType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-8 w-full min-w-0 flex-col gap-2 sm:col-span-1 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="add-schema-req" className="shrink-0 font-normal">
                Required
              </Label>
              <Switch
                id="add-schema-req"
                checked={addDraft.required}
                onCheckedChange={(checked) => setAddDraft((d) => ({ ...d, required: checked }))}
                className="shrink-0"
              />
            </div>
            <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
              <Label htmlFor="add-schema-value-tagged" className="font-normal">
                Value
              </Label>
              <SchemaValueFunctionInput
                fieldId={SCHEMA_ADD_FIELD_ROW_ID}
                fields={fields}
                upstreamPromptTags={upstreamPromptTags}
                contextualPromptTags={contextualPromptTags}
                expressionMode={usageContext === "globals" ? "globals" : "standard"}
                id="add-schema-value-tagged"
                value={addDraft.value}
                onChange={({ value }) => setAddDraft((d) => ({ ...d, value: value ?? "" }))}
                placeholder={schemaValuePlaceholderForType({ type: addDraft.type })}
                rows={schemaValueRowsForType({ type: addDraft.type })}
              />
            </div>
            <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
              <Label htmlFor="add-schema-desc" className="font-normal">
                Description
              </Label>
              <Textarea
                id="add-schema-desc"
                value={addDraft.description}
                onChange={(e) => setAddDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Shown as help text in the runner"
                rows={2}
                className="w-full min-w-0 resize-none text-sm leading-relaxed"
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
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => addFieldFromDraft({ draft: addDraft })}
            >
              Add field
            </Button>
          </div>
        </div>
      )}

      <SchemaDivider />

      {/* Usage hint */}
      {usageContext === "trigger" ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          The next connected step resolves the trigger payload as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev}}"}</code>{" "}
          or field paths such as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev.field_key}}"}</code>{" "}
          matching the keys you declare here.
        </p>
      ) : usageContext === "globals" ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Keys you add here are exposed downstream as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{global.your_key}}"}</code>. Value
          expressions support the same tags as the Output schema on this step (for example{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev.*}}"}</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.*}}"}</code> on AI generate,
          and <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{now.*}}"}</code>) plus other
          declared workflow globals. A later step can set the same key again to override the value for everything
          after it.
        </p>
        ) : usageContext === "output" && contextualPromptTags.length > 0 ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Map outbound keys with{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.text}}"}</code>{" "}
            (and other{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.*}}"}</code>) from this
            step’s AI execution, plus inbound{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev.*}}"}</code>, this
            step&apos;s Input tab as{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code>, sibling
            output rows as{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.field_key}}"}</code>, and
            globals such as{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{now.iso}}"}</code>.
          </p>
        ) : usageContext === "output" ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Manual trigger output rows usually mirror inbound keys via{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            {fields.length > 0
              ? fields
                  .slice(0, 4)
                  .map((f) => `{{input.${f.key}}}`)
                  .join(", ")
              : "{{input.field_key}}"}
          </code>{" "}
          so later steps reuse inbound{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code>{" "}
          for this trigger’s outbound shape and downstream steps consume it as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev.*}}"}</code>.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Use sibling{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            {fields.length > 0
              ? fields
                  .slice(0, 4)
                  .map((f) => `{{input.${f.key}}}`)
                  .join(", ")
              : "{{input.field_key}}"}
          </code>
          , inbound{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{prev.*}}"}</code>, and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{now.*}}"}</code> in mapping values
          where available — use the same expressions in your {hintTarget}
          {usageContext === "prompt" ? " on the Execution tab" : ""}.
        </p>
      )}
    </div>
  )
}

function SchemaDivider() {
  return <div className="h-px w-full bg-border" role="separator" />
}
