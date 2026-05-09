"use client"

import * as React from "react"
import { Braces } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"
import {
  mergeIncomingInputFieldsAppend,
  parseInputSchemaJson,
  serialiseInputSchemaJson,
} from "@/lib/workflows/engine/input-schema"
import { InputSchemaEditor } from "@/components/workflow/input-schema-editor"
import { useWorkflowNavigationResetKey } from "@/components/workflow/workflow-navigation-reset-context"
import {
  useWorkflowOutputStackContext,
  type SchemaEditorStackPanel,
} from "@/components/workflow/workflow-output-stack-context"
import {
  WorkflowSchemaBuilderToolbar,
  type WorkflowSchemaBulkJsonMenuActions,
  type WorkflowSchemaConfirmableImport,
  type WorkflowSchemaImportApplyMode,
  type WorkflowSchemaBuilderToolbarPromptImport,
} from "@/components/workflow/workflow-schema-builder-toolbar"

export type { WorkflowSchemaConfirmableImport, WorkflowSchemaBuilderToolbarPromptImport }

export interface InputSchemaBuilderProps {
  fields: NodeInputField[]
  onChange: ({ fields }: { fields: NodeInputField[] }) => void
  usageContext?: "prompt" | "code" | "trigger" | "output" | "globals"
  /** Custom title for this panel (falls back from `usageContext` to Input schema or Output schema). */
  panelTitle?: string
  /** Tags for the inbound predecessor output (`{{input.*}}`) for default-value autocomplete. */
  upstreamPromptTags?: PromptTagDefinition[]
  /** Execution-level tags (`{{exe.*}}`) and similar merged after upstream tags in mapping controls. */
  contextualPromptTags?: PromptTagDefinition[]
  /**
   * Ordered confirm-before imports (sync from upstream artefact, extraction fields, invoke payload, …).
   * Each entry appears in the header schema actions menu.
   */
  confirmableImports?: WorkflowSchemaConfirmableImport[]
  /** When set with or without {@link confirmableImports}, opens the shared prompt-to-schema flow from the menu. */
  promptImport?: WorkflowSchemaBuilderToolbarPromptImport | null
}

/**
 * Composite schema editor with a visual row editor and JSON bulk edits via the header menu (dialog + clipboard).
 * Intended for nested use inside the workflow node sheet Input tab.
 */
export function InputSchemaBuilder({
  fields,
  onChange,
  usageContext = "prompt",
  panelTitle,
  upstreamPromptTags = [],
  contextualPromptTags = [],
  confirmableImports,
  promptImport,
}: InputSchemaBuilderProps) {
  const [jsonDialogOpen, setJsonDialogOpen] = React.useState(false)
  const [jsonDraft, setJsonDraft] = React.useState("")
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  const [clipboardNotice, setClipboardNotice] = React.useState<string | null>(null)
  const [clipboardMergeOpen, setClipboardMergeOpen] = React.useState(false)
  const [clipboardIncomingFields, setClipboardIncomingFields] = React.useState<NodeInputField[]>([])
  const [clipboardApplyMode, setClipboardApplyMode] = React.useState<WorkflowSchemaImportApplyMode>("append")

  /** Tracks stack drill depth when the sheet does not lift panels (for example Entry trigger output on the Input tab). */
  const [internalStackSurfaceView, setInternalStackSurfaceView] =
    React.useState<SchemaEditorStackPanel["view"]>("list")

  const resolvedPanelTitle =
    panelTitle ??
    (usageContext === "output"
      ? "Output schema"
      : usageContext === "globals"
        ? "Workflow globals"
        : "Input schema")

  const shellSubtitle =
    usageContext === "trigger"
      ? "Document the payload shape callers send into this workflow so downstream steps stay aligned."
      : usageContext === "code"
        ? "Define typed inputs merged into the code sandbox `input` object."
        : usageContext === "output"
          ? "Describe what leaves this step — downstream steps see these keys as {{input.*}}. Map values from {{exe.*}}, the previous step, or workflow globals."
          : usageContext === "globals"
            ? "Optional tag names and expressions. Each key becomes {{global.key}} for any later step; the same key from a later step overrides earlier values."
            : "Define typed inputs as {{input.*}} from the previous step's output and {{trigger_inputs.*}} for the original workflow invoke payload."

  const trimmedConfirmables = [...(confirmableImports ?? [])].filter((row) => row != null)

  const sheetNavigationNodeId = useWorkflowNavigationResetKey()
  const visualNavigationMode: "inline" | "stack" =
    usageContext === "output" || usageContext === "globals" ? "stack" : "inline"

  const workflowOutputStackCtx = useWorkflowOutputStackContext()

  const controlledStackBinding = React.useMemo((): {
    panel: SchemaEditorStackPanel
    setPanel: React.Dispatch<React.SetStateAction<SchemaEditorStackPanel>>
  } | null => {
    if (
      workflowOutputStackCtx == null ||
      workflowOutputStackCtx.enabled !== true ||
      visualNavigationMode !== "stack"
    ) {
      return null
    }
    if (usageContext === "output") {
      return {
        panel: workflowOutputStackCtx.outputSchemaPanel,
        setPanel: workflowOutputStackCtx.setOutputSchemaPanelExclusive,
      }
    }
    if (usageContext === "globals") {
      return {
        panel: workflowOutputStackCtx.globalsPanel,
        setPanel: workflowOutputStackCtx.setGlobalsPanelExclusive,
      }
    }
    return null
  }, [workflowOutputStackCtx, visualNavigationMode, usageContext])

  React.useEffect(() => {
    if (visualNavigationMode !== "stack") return
    if (controlledStackBinding != null) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset internal drill state when the owning node changes */
    setInternalStackSurfaceView("list")
  }, [sheetNavigationNodeId, visualNavigationMode, controlledStackBinding])

  const resolvedStackSurfaceView =
    controlledStackBinding != null ? controlledStackBinding.panel.view : internalStackSurfaceView

  /** Import/export and JSON bulk actions stay on the list surface only. */
  const hideSchemaHeaderActions = visualNavigationMode === "stack" && resolvedStackSurfaceView !== "list"

  const bulkJsonMenuEligible = !hideSchemaHeaderActions

  const showHeaderToolbar =
    !hideSchemaHeaderActions &&
    (trimmedConfirmables.length > 0 ||
      (promptImport != null && typeof promptImport === "object") ||
      bulkJsonMenuEligible)

  /** While drilling on the Output tab, drop the builder branding row — titles live on the sheet sub-nav instead. */
  const suppressBuilderChromeRow =
    hideSchemaHeaderActions && workflowOutputStackCtx?.enabled === true

  /** Bumps when the sheet node changes so stacked field navigation resets safely. */
  const schemaNavigationResetKey =
    visualNavigationMode === "stack" ? sheetNavigationNodeId ?? "detached" : undefined

  /** Full-width focus on the Output tab — hide the sibling Output schema / globals card while drilling. */
  const hideOutputGlobalsSiblingShell =
    workflowOutputStackCtx?.enabled === true &&
    visualNavigationMode === "stack" &&
    workflowOutputStackCtx.activeScope != null &&
    workflowOutputStackCtx.activeScope !== (usageContext === "output" ? "outputSchema" : "globals")

  /** Opens JSON editing — resets lifted stacks like the former JSON tab did. */
  function handleOpenJsonDialog() {
    workflowOutputStackCtx?.resetBothPanels()
    setJsonDraft(serialiseInputSchemaJson({ fields }))
    setJsonError(null)
    setJsonDialogOpen(true)
  }

  /** Applies parsed JSON rows back onto the workflow node draft. */
  function handleApplyJson() {
    const result = parseInputSchemaJson({ text: jsonDraft })
    if (!result.ok) {
      setJsonError(result.error)
      return
    }
    setJsonError(null)
    onChange({ fields: result.fields })
    setJsonDraft(serialiseInputSchemaJson({ fields: result.fields }))
  }

  /** Pretty-prints valid JSON or surfaces the parser error inline. */
  function handleFormatJson() {
    const result = parseInputSchemaJson({ text: jsonDraft })
    if (!result.ok) {
      setJsonError(result.error)
      return
    }
    setJsonError(null)
    setJsonDraft(serialiseInputSchemaJson({ fields: result.fields }))
  }

  /** Copies the current schema serialisation for sharing or backups. */
  async function handleCopyJsonToClipboard() {
    const text = serialiseInputSchemaJson({ fields })
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setClipboardNotice("Unable to copy — check browser clipboard permissions.")
    }
  }

  /** Reads clipboard JSON and opens merge confirmation when valid. */
  async function handleImportJsonFromClipboard() {
    let text = ""
    try {
      text = await navigator.clipboard.readText()
    } catch {
      setClipboardNotice("Unable to read clipboard — check browser permissions.")
      return
    }
    const result = parseInputSchemaJson({ text })
    if (!result.ok) {
      setClipboardNotice(result.error)
      return
    }
    setClipboardApplyMode("append")
    setClipboardIncomingFields(result.fields)
    setClipboardMergeOpen(true)
  }

  /** Applies clipboard-imported rows using the author’s append vs replace choice. */
  function handleConfirmClipboardImport() {
    if (clipboardApplyMode === "replace") {
      onChange({ fields: clipboardIncomingFields })
    } else {
      const { merged } = mergeIncomingInputFieldsAppend({
        existing: fields,
        incoming: clipboardIncomingFields,
      })
      onChange({ fields: merged })
    }
    setClipboardMergeOpen(false)
    setClipboardIncomingFields([])
  }

  const bulkJsonMenu: WorkflowSchemaBulkJsonMenuActions | undefined = bulkJsonMenuEligible
    ? {
        visible: true,
        onEditAsJson: handleOpenJsonDialog,
        onCopyJson: handleCopyJsonToClipboard,
        onImportJsonFromClipboard: handleImportJsonFromClipboard,
      }
    : undefined

  if (hideOutputGlobalsSiblingShell) return null

  return (
    <div
      className={cn(
        "min-w-0 w-full overflow-hidden",
        !suppressBuilderChromeRow && "rounded-xl border border-border/80 bg-card/40",
      )}
    >
      {/* Branding row — mirrors professional API tools (compact header + monospace body below) */}
      {!suppressBuilderChromeRow ? (
        <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background"
            aria-hidden
          >
            <Braces className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-none tracking-tight text-foreground">{resolvedPanelTitle}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{shellSubtitle}</p>
          </div>
          {/* Schema actions menu — imports, prompt fill, JSON */}
          {showHeaderToolbar ? (
            <WorkflowSchemaBuilderToolbar
              confirmableImports={trimmedConfirmables}
              promptImport={promptImport ?? undefined}
              existingFields={fields}
              onPromptApplyFields={({ fields: next }) => onChange({ fields: next })}
              bulkJsonMenu={bulkJsonMenu}
            />
          ) : null}
        </div>
      ) : null}

      <div className={cn(!suppressBuilderChromeRow && "space-y-0 px-4 pb-4 pt-3", suppressBuilderChromeRow && "min-w-0 w-full")}>
        {/* Form-style field list */}
        <InputSchemaEditor
          fields={fields}
          onChange={onChange}
          usageContext={usageContext}
          showHeader={false}
          upstreamPromptTags={upstreamPromptTags}
          contextualPromptTags={contextualPromptTags}
          visualNavigationMode={visualNavigationMode}
          navigationResetKey={schemaNavigationResetKey}
          controlledStackBinding={controlledStackBinding}
          onStackSurfaceChange={
            visualNavigationMode === "stack" && controlledStackBinding == null
              ? ({ view }) => setInternalStackSurfaceView(view)
              : undefined
          }
        />
      </div>

      {/* JSON editor — opened from header menu only */}
      <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
        <DialogContent className="gap-4 sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit schema as JSON</DialogTitle>
            <DialogDescription>
              Changes apply when you choose Apply. Format checks syntax without updating the visual editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Raw schema</Label>
            <Textarea
              value={jsonDraft}
              onChange={(e) => {
                setJsonDraft(e.target.value)
                setJsonError(null)
              }}
              spellCheck={false}
              rows={14}
              className="min-h-[220px] resize-y font-mono text-xs leading-relaxed"
              placeholder={`[\n  {\n    "key": "notify",\n    "label": "Notify",\n    "type": "boolean",\n    "required": false,\n    "value": false\n  }\n]`}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Each item supports{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">key</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">label</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">type</code> (string, text, number,
              boolean, json),{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">required</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">description</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">value</code> (plain text or tag
              placeholders such as{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{input.text}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{trigger_inputs.key}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{now.iso}}"}</code>; older drafts may
              still list{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{prev.*}}"}</code> or{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">steps.*</code>;{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">defaultValue</code> is merged on load).
            </p>
          </div>

          {jsonError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
            >
              {jsonError}
            </p>
          ) : null}

          {/* JSON dialog actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="font-normal" onClick={handleFormatJson}>
              Format
            </Button>
            <Button type="button" size="sm" className="font-normal" onClick={handleApplyJson}>
              Apply to visual editor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {clipboardNotice ? (
        <AlertDialog open onOpenChange={(open) => !open && setClipboardNotice(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clipboard</AlertDialogTitle>
              <AlertDialogDescription className="text-left">{clipboardNotice}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setClipboardNotice(null)}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <AlertDialog
        open={clipboardMergeOpen}
        onOpenChange={(open) => {
          setClipboardMergeOpen(open)
          if (!open) {
            setClipboardIncomingFields([])
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import JSON from clipboard?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              <div className="space-y-4">
                <p className="leading-relaxed">
                  Parsed {clipboardIncomingFields.length} field{clipboardIncomingFields.length === 1 ? "" : "s"} from the
                  clipboard. Choose how to merge with the current rows.
                </p>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">How to apply</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={clipboardApplyMode === "append" ? "default" : "outline"}
                      className="font-normal"
                      onClick={() => setClipboardApplyMode("append")}
                    >
                      Append new keys
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={clipboardApplyMode === "replace" ? "default" : "outline"}
                      className="font-normal"
                      onClick={() => setClipboardApplyMode("replace")}
                    >
                      Replace existing
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Append keeps your current rows and skips duplicate keys. Replace rebuilds the list from the clipboard
                    only.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClipboardImport}>Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
