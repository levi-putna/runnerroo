"use client"

import * as React from "react"
import { AlignLeft, ArrowLeft, Braces, Hash, Plus, ToggleLeft, Trash2, Type } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
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
import { WorkflowEditableListRow } from "@/components/workflow/workflow-editable-list-row"
import {
  WorkflowSchemaRowsSortableList,
  WorkflowSchemaSortableGrip,
} from "@/components/workflow/workflow-schema-rows-sortable-list"
import { useWorkflowOutputStackContext, type SchemaEditorStackPanel } from "@/components/workflow/workflow-output-stack-context"
import { workflowStackSlideVariants } from "@/components/workflow/workflow-stack-motion"

const TYPE_META: Record<
  NodeInputFieldType,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  string: { label: "String", Icon: Type },
  text: { label: "Text", Icon: AlignLeft },
  number: { label: "Number", Icon: Hash },
  boolean: { label: "Boolean", Icon: ToggleLeft },
  json: { label: "JSON", Icon: Braces },
}

export interface InputSchemaEditorProps {
  fields: NodeInputField[]
  onChange: ({ fields }: { fields: NodeInputField[] }) => void
  /** Where the user will reference `{{input.*}}` — adjusts the hint copy. */
  usageContext?: "prompt" | "code" | "trigger" | "output" | "globals"
  /** When false, hides the outer section heading when composed inside a parent schema editor shell. */
  showHeader?: boolean
  /** Inbound predecessor output tags (`input`, `input.text`, …) for mapping cell autocomplete. */
  upstreamPromptTags?: PromptTagDefinition[]
  /** Extra contextual tags merged after upstream tags (for example `{{exe.*}}` execution outputs). */
  contextualPromptTags?: PromptTagDefinition[]
  /**
   * `inline` expands edits in place (default). `stack` pushes a detail pane like Switch cases — used for
   * Output schema and Workflow globals in the node sheet.
   */
  visualNavigationMode?: "inline" | "stack"
  /** When set (typically the owning workflow node id), resets stack navigation to the field list. */
  navigationResetKey?: string
  /**
   * When set with stack visual mode on the Output sheet tab, panel state is lifted so the sheet can replace the tab strip.
   */
  controlledStackBinding?: {
    panel: SchemaEditorStackPanel
    setPanel: React.Dispatch<React.SetStateAction<SchemaEditorStackPanel>>
  } | null
  /**
   * When stack navigation runs internally (not lifted to the sheet), notifies the parent so list-only chrome
   * such as import/export menus can hide while drilling field/add views.
   */
  onStackSurfaceChange?: ({ view }: { view: SchemaEditorStackPanel["view"] }) => void
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

/** Sentinel id while the “add field” draft has no persisted row yet — sibling tags include every saved row. */
const SCHEMA_ADD_FIELD_ROW_ID = "__schema-add-draft__"

interface SchemaValueFunctionInputProps {
  /** Stable row id or {@link SCHEMA_ADD_FIELD_ROW_ID} for the add form. */
  fieldId: string
  fields: NodeInputField[]
  /** Tags for the inbound predecessor output (`{{input.*}}`). */
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
 * Schema field default value editor: literals plus globals, inbound `{{input.*}}` from the
 * previous step, and sibling output rows referenced as `{{input.other_field}}`.
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
      ? "Each row writes one key on the run-wide globals map ({{global.this_key}} for later nodes). Use the same tags as the Output schema above: {{input.*}} from the previous step, {{trigger_inputs.*}} for the original workflow invoke payload, {{exe.*}} after the step runs, incoming {{global.*}} from earlier steps, and {{now.*}}. Rows on this tab only see incoming globals, not other rows on this tab. Resolution order is defined by the runner."
      : contextualPromptTags.length > 0
        ? "Mix literals with workflow tags — {{exe.*}} values come from this step’s execution result (tokens, model id, assistant text). Combine with {{input.*}} from the previous step, sibling output rows as {{input.other_field}}, globals, {{now.iso}}, etc. Resolution order is defined by the runner."
        : "Mix literals with workflow tags — for example {{now.iso}}, {{input.text}} from the previous step, or {{trigger_inputs.*}} for the original invoke payload. Boolean rows accept true/false literals or tags that resolve to booleans at runtime. Resolution order is defined by the runner."

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
  if (type === "boolean") return "true, false, {{input.some_flag}}, or {{global.is_enabled}}"
  if (type === "number") return "0, {{now.unix_ms}}, or {{input.age}}"
  if (type === "text") return "Fallback text or {{now.iso}}"
  if (type === "json") {
    return '{{input.risks}} or paste JSON — e.g. [{"description":"…","likelihood":"High","impact":"High","mitigation":"…"}]'
  }
  return "Fallback — literals or tags"
}

/**
 * Row count for the tagged value editor; long-form `text` gets an extra line.
 */
function schemaValueRowsForType({ type }: { type: NodeInputFieldType }): number {
  if (type === "json") return 8
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
  visualNavigationMode = "inline",
  navigationResetKey,
  controlledStackBinding = null,
  onStackSurfaceChange,
}: InputSchemaEditorProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [addDraft, setAddDraft] = React.useState<DraftField>(() => emptyDraft())
  const [editDraft, setEditDraft] = React.useState<DraftField | null>(null)

  const [internalStackPanel, setInternalStackPanel] = React.useState<SchemaEditorStackPanel>({ view: "list" })
  const [stackNavDirection, setStackNavDirection] = React.useState(1)

  const stackPanel = controlledStackBinding != null ? controlledStackBinding.panel : internalStackPanel
  const setStackPanel = controlledStackBinding != null ? controlledStackBinding.setPanel : setInternalStackPanel

  const sheetChromeOwnsStackBack = controlledStackBinding != null

  /** Resolved row when drilling a stacked field — used before the stack-mode early return for sheet chrome hooks. */
  const stackDetailFieldForChrome =
    visualNavigationMode === "stack" && stackPanel.view === "field"
      ? fields.find((f) => f.id === stackPanel.fieldId) ?? null
      : null

  const workflowOutputStackForSubHeader = useWorkflowOutputStackContext()

  React.useEffect(() => {
    if (navigationResetKey === undefined || navigationResetKey === "") return
    /* eslint-disable react-hooks/set-state-in-effect -- sync draft UI when navigation key bumps (lifted stack resets elsewhere) */
    if (sheetChromeOwnsStackBack) {
      setShowAddForm(false)
      setEditingId(null)
      setEditDraft(null)
      setAddDraft(emptyDraft())
      return
    }
    setInternalStackPanel({ view: "list" })
    setShowAddForm(false)
    setEditingId(null)
    setEditDraft(null)
    setAddDraft(emptyDraft())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [navigationResetKey, sheetChromeOwnsStackBack])

  React.useEffect(() => {
    if (visualNavigationMode !== "stack" || stackPanel.view !== "field") return
    if (!fields.some((f) => f.id === stackPanel.fieldId)) {
      /* Field removed while stack detail open — return to list */
      /* eslint-disable react-hooks/set-state-in-effect -- close orphaned detail view */
      setStackPanel({ view: "list" })
      setEditDraft(null)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [visualNavigationMode, fields, stackPanel, setStackPanel])

  const stackDetailFieldId = stackPanel.view === "field" ? stackPanel.fieldId : null
  React.useEffect(() => {
    if (visualNavigationMode !== "stack" || stackDetailFieldId == null) return
    const f = fields.find((x) => x.id === stackDetailFieldId)
    if (f) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- seed draft when opening a stacked field */
      setEditDraft(draftFromField({ field: f }))
    }
    // Seed draft when opening this field only — not when `fields` identity churns during editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualNavigationMode, stackDetailFieldId])

  React.useEffect(() => {
    if (visualNavigationMode !== "stack") return
    if (controlledStackBinding != null) return
    onStackSurfaceChange?.({ view: stackPanel.view })
  }, [visualNavigationMode, controlledStackBinding, stackPanel.view, onStackSurfaceChange])

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

  function addFieldFromDraft({
    draft,
    afterCommit,
  }: {
    draft: DraftField
    /** Runs after the new field is appended (for example closing a stack navigator panel). */
    afterCommit?: () => void
  }) {
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
    afterCommit?.()
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

  function saveStackFieldEdit({ id }: { id: string }) {
    saveEdit({ id })
    setStackNavDirection(-1)
    setStackPanel({ view: "list" })
  }

  function popStackToList() {
    setStackNavDirection(-1)
    setStackPanel({ view: "list" })
    setEditDraft(null)
  }

  function drillStackField({ field }: { field: NodeInputField }) {
    setStackNavDirection(1)
    setStackPanel({ view: "field", fieldId: field.id })
  }

  function openStackAddPanel() {
    setStackNavDirection(1)
    setStackPanel({ view: "add" })
    setAddDraft(emptyDraft())
  }

  function cancelStackAddPanel() {
    setStackNavDirection(-1)
    setStackPanel({ view: "list" })
    setAddDraft(emptyDraft())
  }

  /** Output tab sheet sub-header: primary + Cancel wired from drill-down editors. */
  /* eslint-disable react-hooks/exhaustive-deps -- handler identities churn each render; registrations keyed off drafts/panel views */
  React.useEffect(() => {
    const register = workflowOutputStackForSubHeader?.registerOutputStackSubHeaderActions
    if (register == null) return undefined

    const sheetOwnsSubHeaderActions =
      visualNavigationMode === "stack" &&
      sheetChromeOwnsStackBack &&
      workflowOutputStackForSubHeader?.enabled === true

    if (!sheetOwnsSubHeaderActions || stackPanel.view === "list") {
      register(null)
      return () => register(null)
    }

    if (stackPanel.view === "add") {
      register({
        primaryLabel: "Add field",
        onPrimary: () =>
          addFieldFromDraft({
            draft: addDraft,
            afterCommit: () => {
              setStackNavDirection(-1)
              setStackPanel({ view: "list" })
            },
          }),
        onCancel: () => cancelStackAddPanel(),
      })
      return () => register(null)
    }

    if (stackPanel.view === "field" && editDraft != null && stackDetailFieldForChrome != null) {
      const fieldId = stackDetailFieldForChrome.id
      register({
        primaryLabel: "Save field",
        onPrimary: () => saveStackFieldEdit({ id: fieldId }),
        onCancel: () => popStackToList(),
      })
      return () => register(null)
    }

    register(null)
    return () => register(null)
  }, [
    workflowOutputStackForSubHeader,
    visualNavigationMode,
    sheetChromeOwnsStackBack,
    stackPanel.view,
    editDraft,
    addDraft,
    stackDetailFieldForChrome?.id,
  ])
  /* eslint-enable react-hooks/exhaustive-deps */

  const hintTarget = usageContext === "code" ? "code" : "prompt"

  const stackMotionKey =
    stackPanel.view === "list"
      ? "schema-stack-list"
      : stackPanel.view === "add"
        ? "schema-stack-add"
        : `schema-stack-field:${stackPanel.fieldId}`

  if (visualNavigationMode === "stack") {
    const activeStackField =
      stackPanel.view === "field" ? (fields.find((f) => f.id === stackPanel.fieldId) ?? null) : null

    return (
      <div className="relative min-h-[120px] min-w-0 w-full space-y-4 overflow-hidden">
        {/* Section title */}
        {showHeader ? (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {usageContext === "globals" ? "Global tags" : "Input fields"}
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {usageContext === "output"
                ? "Outbound keys forwarded after a manual run. Tap a row to edit mapping and metadata."
                : usageContext === "globals"
                  ? "Each key becomes {{global.key}} for any downstream step. Tap a row to edit its expression."
                  : "Tap a row to edit field details."}
            </p>
          </div>
        ) : null}

        <div className="relative min-h-[80px] overflow-hidden">
          <AnimatePresence initial={false} mode="wait" custom={stackNavDirection}>
            <motion.div
              key={stackMotionKey}
              custom={stackNavDirection}
              variants={workflowStackSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              {stackPanel.view === "list" ? (
                <div className="space-y-4">
                  {/* Field list */}
                  <div className="space-y-2">
                    {fields.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                        {usageContext === "globals"
                          ? "No workflow globals yet. Add a tag name and expression — later steps read values as {{global.tag_key}}."
                          : "No fields yet. Add a field to shape what this step exposes downstream."}
                      </p>
                    ) : null}

                    {fields.length > 0 ? (
                      <WorkflowSchemaRowsSortableList
                        items={fields}
                        onReorder={({ next }) => commitFields({ next })}
                        renderDragOverlay={({ item }) => {
                          const overlayMeta = TYPE_META[item.type]
                          const OverlayIcon = overlayMeta.Icon
                          return (
                            <div className="pointer-events-none flex min-w-[240px] items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 shadow-lg">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                                <OverlayIcon className="size-4" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate font-mono text-sm font-medium">{item.key}</span>
                                  <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                                    {overlayMeta.label}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )
                        }}
                        renderRow={({
                          item: field,
                          spacingBelow,
                          isDragging,
                          sortableStyle,
                          mergedSortableRef,
                          setActivatorNodeRef,
                          dragAttributes,
                          dragListeners,
                        }) => {
                          const meta = TYPE_META[field.type]
                          const Icon = meta.Icon
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
                              <WorkflowEditableListRow
                                suppressFocusChrome
                                leading={
                                  <WorkflowSchemaSortableGrip
                                    setActivatorNodeRef={setActivatorNodeRef}
                                    attributes={dragAttributes}
                                    listeners={dragListeners}
                                    ariaLabel="Drag to reorder field"
                                  />
                                }
                                onActivate={() => drillStackField({ field })}
                                showChevron
                                trailing={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      removeField({ id: field.id })
                                    }}
                                    aria-label={`Remove field ${field.key}`}
                                  >
                                    <Trash2 className="size-4" aria-hidden />
                                  </Button>
                                }
                              >
                                {/* Type glyph */}
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
                                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                                      Value: {field.value}
                                    </p>
                                  ) : null}
                                </div>
                              </WorkflowEditableListRow>
                            </div>
                          )
                        }}
                      />
                    ) : null}
                  </div>

                  <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={openStackAddPanel}>
                    <Plus className="size-4" aria-hidden />
                    Add field
                  </Button>

                  <SchemaDivider />

                  {/* Usage hint */}
                  {usageContext === "trigger" ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The next connected step resolves the trigger payload as{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input}}"}</code>{" "}
                      or field paths such as{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.field_key}}"}</code>{" "}
                      matching the keys you declare here.
                    </p>
                  ) : usageContext === "globals" ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Keys you add here are exposed downstream as{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{global.your_key}}"}</code>.
                      Value expressions support the same tags as the Output schema on this step.
                    </p>
                  ) : usageContext === "output" && contextualPromptTags.length > 0 ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Map outbound keys with{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.text}}"}</code> and
                      other execution tags, plus inbound{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> from the
                      previous step.
                    </p>
                  ) : usageContext === "output" ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Trigger output rows usually mirror inbound keys via{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        {fields.length > 0
                          ? fields
                              .slice(0, 4)
                              .map((f) => `{{input.${f.key}}}`)
                              .join(", ")
                          : "{{input.field_key}}"}
                      </code>
                      .
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Use sibling field tags and inbound{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> in
                      mapping values where available.
                    </p>
                  )}
                </div>
              ) : stackPanel.view === "add" ? (
                <div className="space-y-4">
                  {!sheetChromeOwnsStackBack ? (
                    <button
                      type="button"
                      onClick={cancelStackAddPanel}
                      className="mb-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <ArrowLeft className="size-4" aria-hidden />
                      <span>All fields</span>
                    </button>
                  ) : null}
                  {sheetChromeOwnsStackBack ? null : (
                    <Label className="text-[10px] font-semibold uppercase text-muted-foreground">New field</Label>
                  )}
                  <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                      <Label htmlFor="stack-add-schema-key">Key</Label>
                      <Input
                        id="stack-add-schema-key"
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
                      <Label htmlFor="stack-add-schema-label">Label</Label>
                      <Input
                        id="stack-add-schema-label"
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
                      <Label htmlFor="stack-add-schema-type">Type</Label>
                      <Select
                        value={addDraft.type}
                        onValueChange={(v) => setAddDraft((d) => ({ ...d, type: v as NodeInputFieldType }))}
                      >
                        <SelectTrigger id="stack-add-schema-type" className="w-full min-w-0">
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
                      <Label htmlFor="stack-add-schema-req" className="shrink-0 font-normal">
                        Required
                      </Label>
                      <Switch
                        id="stack-add-schema-req"
                        checked={addDraft.required}
                        onCheckedChange={(checked) => setAddDraft((d) => ({ ...d, required: checked }))}
                        className="shrink-0"
                      />
                    </div>
                    <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                      <Label htmlFor="stack-add-schema-value-tagged" className="font-normal">
                        Value
                      </Label>
                      <SchemaValueFunctionInput
                        fieldId={SCHEMA_ADD_FIELD_ROW_ID}
                        fields={fields}
                        upstreamPromptTags={upstreamPromptTags}
                        contextualPromptTags={contextualPromptTags}
                        expressionMode={usageContext === "globals" ? "globals" : "standard"}
                        id="stack-add-schema-value-tagged"
                        value={addDraft.value}
                        onChange={({ value }) => setAddDraft((d) => ({ ...d, value: value ?? "" }))}
                        placeholder={schemaValuePlaceholderForType({ type: addDraft.type })}
                        rows={schemaValueRowsForType({ type: addDraft.type })}
                      />
                    </div>
                    <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                      <Label htmlFor="stack-add-schema-desc" className="font-normal">
                        Description
                      </Label>
                      <Textarea
                        id="stack-add-schema-desc"
                        value={addDraft.description}
                        onChange={(e) => setAddDraft((d) => ({ ...d, description: e.target.value }))}
                        placeholder="Shown as help text in the runner"
                        rows={2}
                        className="w-full min-w-0 resize-none text-sm leading-relaxed"
                      />
                    </div>
                  </div>
                  {/* Footer actions live on the sheet sub-header while drilling Output / globals */}
                  {!sheetChromeOwnsStackBack ? (
                    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={cancelStackAddPanel}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() =>
                          addFieldFromDraft({
                            draft: addDraft,
                            afterCommit: () => {
                              setStackNavDirection(-1)
                              setStackPanel({ view: "list" })
                            },
                          })
                        }
                      >
                        Add field
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : activeStackField !== null && editDraft ? (
                <div className="space-y-4">
                  {!sheetChromeOwnsStackBack ? (
                    <button
                      type="button"
                      onClick={popStackToList}
                      className="mb-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <ArrowLeft className="size-4" aria-hidden />
                      <span>All fields</span>
                    </button>
                  ) : null}

                  {sheetChromeOwnsStackBack ? (
                    <div className="min-w-0 space-y-3">
                      <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                          <Label htmlFor={`stack-edit-key-${activeStackField.id}`}>Key</Label>
                          <Input
                            id={`stack-edit-key-${activeStackField.id}`}
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
                          <Label htmlFor={`stack-edit-label-${activeStackField.id}`}>Label</Label>
                          <Input
                            id={`stack-edit-label-${activeStackField.id}`}
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
                          <Label htmlFor={`stack-edit-type-${activeStackField.id}`}>Type</Label>
                          <Select
                            value={editDraft.type}
                            onValueChange={(v) =>
                              setEditDraft((d) => (d ? { ...d, type: v as NodeInputFieldType } : d))
                            }
                          >
                            <SelectTrigger id={`stack-edit-type-${activeStackField.id}`} className="w-full min-w-0">
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
                          <Label htmlFor={`stack-edit-req-${activeStackField.id}`} className="shrink-0 font-normal">
                            Required
                          </Label>
                          <Switch
                            id={`stack-edit-req-${activeStackField.id}`}
                            checked={editDraft.required}
                            onCheckedChange={(checked) =>
                              setEditDraft((d) => (d ? { ...d, required: checked } : d))
                            }
                            className="shrink-0"
                          />
                        </div>
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`stack-edit-schema-value-${activeStackField.id}`} className="font-normal">
                            Value
                          </Label>
                          <SchemaValueFunctionInput
                            fieldId={activeStackField.id}
                            fields={fields}
                            upstreamPromptTags={upstreamPromptTags}
                            contextualPromptTags={contextualPromptTags}
                            expressionMode={usageContext === "globals" ? "globals" : "standard"}
                            id={`stack-edit-schema-value-${activeStackField.id}`}
                            value={editDraft.value}
                            onChange={({ value }) =>
                              setEditDraft((d) => (d ? { ...d, value: value ?? "" } : d))
                            }
                            placeholder={schemaValuePlaceholderForType({ type: editDraft.type })}
                            rows={schemaValueRowsForType({ type: editDraft.type })}
                          />
                        </div>
                        <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`stack-edit-desc-${activeStackField.id}`} className="font-normal">
                            Description
                          </Label>
                          <Textarea
                            id={`stack-edit-desc-${activeStackField.id}`}
                            value={editDraft.description}
                            onChange={(e) =>
                              setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))
                            }
                            placeholder="Shown as help text in the runner"
                            rows={2}
                            className="w-full min-w-0 resize-none text-sm leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg border border-border bg-muted/15 p-3"
                      role="group"
                      aria-label={`Edit field ${activeStackField.label}`}
                    >
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="min-w-0 w-full space-y-1.5 sm:col-span-1">
                            <Label htmlFor={`stack-edit-key-${activeStackField.id}`}>Key</Label>
                            <Input
                              id={`stack-edit-key-${activeStackField.id}`}
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
                            <Label htmlFor={`stack-edit-label-${activeStackField.id}`}>Label</Label>
                            <Input
                              id={`stack-edit-label-${activeStackField.id}`}
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
                            <Label htmlFor={`stack-edit-type-${activeStackField.id}`}>Type</Label>
                            <Select
                              value={editDraft.type}
                              onValueChange={(v) =>
                                setEditDraft((d) => (d ? { ...d, type: v as NodeInputFieldType } : d))
                              }
                            >
                              <SelectTrigger id={`stack-edit-type-${activeStackField.id}`} className="w-full min-w-0">
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
                            <Label htmlFor={`stack-edit-req-${activeStackField.id}`} className="shrink-0 font-normal">
                              Required
                            </Label>
                            <Switch
                              id={`stack-edit-req-${activeStackField.id}`}
                              checked={editDraft.required}
                              onCheckedChange={(checked) =>
                                setEditDraft((d) => (d ? { ...d, required: checked } : d))
                              }
                              className="shrink-0"
                            />
                          </div>
                          <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                            <Label htmlFor={`stack-edit-schema-value-${activeStackField.id}`} className="font-normal">
                              Value
                            </Label>
                            <SchemaValueFunctionInput
                              fieldId={activeStackField.id}
                              fields={fields}
                              upstreamPromptTags={upstreamPromptTags}
                              contextualPromptTags={contextualPromptTags}
                              expressionMode={usageContext === "globals" ? "globals" : "standard"}
                              id={`stack-edit-schema-value-${activeStackField.id}`}
                              value={editDraft.value}
                              onChange={({ value }) =>
                                setEditDraft((d) => (d ? { ...d, value: value ?? "" } : d))
                              }
                              placeholder={schemaValuePlaceholderForType({ type: editDraft.type })}
                              rows={schemaValueRowsForType({ type: editDraft.type })}
                            />
                          </div>
                          <div className="min-w-0 w-full space-y-1.5 sm:col-span-2">
                            <Label htmlFor={`stack-edit-desc-${activeStackField.id}`} className="font-normal">
                              Description
                            </Label>
                            <Textarea
                              id={`stack-edit-desc-${activeStackField.id}`}
                              value={editDraft.description}
                              onChange={(e) =>
                                setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))
                              }
                              placeholder="Shown as help text in the runner"
                              rows={2}
                              className="w-full min-w-0 resize-none text-sm leading-relaxed"
                            />
                          </div>
                        </div>
                        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={popStackToList}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => saveStackFieldEdit({ id: activeStackField.id })}
                          >
                            Save field
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    )
  }

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

        {fields.length > 0 ? (
          <WorkflowSchemaRowsSortableList
            items={fields}
            onReorder={({ next }) => commitFields({ next })}
            renderDragOverlay={({ item }) => {
              const overlayMeta = TYPE_META[item.type]
              const OverlayIcon = overlayMeta.Icon
              return (
                <div className="pointer-events-none flex min-w-[240px] items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 shadow-lg">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <OverlayIcon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium">{item.key}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                        {overlayMeta.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            }}
            renderRow={({
              item: field,
              spacingBelow,
              isDragging,
              sortableStyle,
              mergedSortableRef,
              setActivatorNodeRef,
              dragAttributes,
              dragListeners,
            }) => {
              const meta = TYPE_META[field.type]
              const Icon = meta.Icon
              const isEditing = editingId === field.id

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
                <div
                  className="rounded-lg border border-border bg-muted/15 p-3"
                  role="group"
                  aria-label={`Edit field ${field.label}`}
                >
                  <div className="flex items-stretch gap-2">
                    <WorkflowSchemaSortableGrip
                      setActivatorNodeRef={setActivatorNodeRef}
                      attributes={dragAttributes}
                      listeners={dragListeners}
                      ariaLabel="Drag to reorder field"
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
                  ref={mergedSortableRef}
                  style={sortableStyle}
                  className={cn(
                    "min-w-0 rounded-lg",
                    isDragging && "relative z-[1] opacity-[0.35]",
                    spacingBelow && "mb-2",
                  )}
                >
                  <WorkflowEditableListRow
                    suppressFocusChrome
                    leading={
                      <WorkflowSchemaSortableGrip
                        setActivatorNodeRef={setActivatorNodeRef}
                        attributes={dragAttributes}
                        listeners={dragListeners}
                        ariaLabel="Drag to reorder field"
                      />
                    }
                    onActivate={() => openEdit({ field })}
                    trailing={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          removeField({ id: field.id })
                        }}
                        aria-label={`Remove field ${field.key}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    }
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
                        <p className="truncate font-mono text-[11px] text-muted-foreground">Value: {field.value}</p>
                      ) : null}
                    </div>
                  </WorkflowEditableListRow>
                </div>
              )
            }}
          />
        ) : null}
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
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input}}"}</code>{" "}
          or field paths such as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.field_key}}"}</code>{" "}
          matching the keys you declare here. The original payload also remains accessible as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{trigger_inputs.*}}"}</code>{" "}
          on every downstream step.
        </p>
      ) : usageContext === "globals" ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Keys you add here are exposed downstream as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{global.your_key}}"}</code>. Value
          expressions support the same tags as the Output schema on this step (for example{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> from the
          previous step,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{trigger_inputs.*}}"}</code> for the
          original invoke payload,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.*}}"}</code> after the step
          runs, and <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{now.*}}"}</code>) plus
          other declared workflow globals. A later step can set the same key again to override the value for
          everything after it.
        </p>
        ) : usageContext === "output" && contextualPromptTags.length > 0 ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Map outbound keys with{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.text}}"}</code>{" "}
            (and other{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.*}}"}</code>) from this
            step’s execution, plus inbound{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> from the
            previous step,{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{trigger_inputs.*}}"}</code> for
            the original invoke payload, sibling output rows as{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.field_key}}"}</code>, and
            globals such as{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{now.iso}}"}</code>.
          </p>
        ) : usageContext === "output" ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Trigger output rows usually mirror inbound keys via{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            {fields.length > 0
              ? fields
                  .slice(0, 4)
                  .map((f) => `{{input.${f.key}}}`)
                  .join(", ")
              : "{{input.field_key}}"}
          </code>{" "}
          so later steps consume the trigger&apos;s outbound shape as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> on the next
          step.
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
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{input.*}}"}</code> from the
          previous step, and{" "}
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
