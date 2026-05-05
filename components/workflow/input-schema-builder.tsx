"use client"

import * as React from "react"
import { Braces, LayoutList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"
import {
  parseInputSchemaJson,
  serialiseInputSchemaJson,
} from "@/lib/workflows/engine/input-schema"
import { InputSchemaEditor } from "@/components/workflow/input-schema-editor"
import {
  SchemaFromPromptDialog,
  SchemaFromPromptImportTrigger,
} from "@/components/workflow/schema-from-prompt-dialog"
import type { WorkflowInputSchemaFromPromptFlavourId } from "@/lib/workflows/input-schema-from-prompt-flavours"

export interface InputSchemaBuilderProps {
  fields: NodeInputField[]
  onChange: ({ fields }: { fields: NodeInputField[] }) => void
  usageContext?: "prompt" | "code" | "trigger" | "output" | "globals"
  /** Custom title for this panel (falls back from `usageContext` to Input schema or Output schema). */
  panelTitle?: string
  /** Tags for the inbound predecessor output (`{{prev.*}}`) for default-value autocomplete. */
  upstreamPromptTags?: PromptTagDefinition[]
  /** Execution-level tags (`{{exe.*}}`) and similar merged after upstream tags in mapping controls. */
  contextualPromptTags?: PromptTagDefinition[]
  /**
   * When set, shows an “Import from prompt” control that calls the shared schema agent.
   * Add flavours in `WORKFLOW_INPUT_SCHEMA_FROM_PROMPT_FLAVOURS` (see `lib/workflows/input-schema-from-prompt-flavours.ts`) for future schema sinks.
   */
  promptImport?: {
    flavourId: WorkflowInputSchemaFromPromptFlavourId
    dialogTitle?: string
    dialogDescription?: string
  }
}

/**
 * Composite schema editor with a visual row editor and a raw JSON tab (similar to Postman body modes).
 * Intended for nested use inside the workflow node sheet Input tab.
 */
export function InputSchemaBuilder({
  fields,
  onChange,
  usageContext = "prompt",
  panelTitle,
  upstreamPromptTags = [],
  contextualPromptTags = [],
  promptImport,
}: InputSchemaBuilderProps) {
  const [editorTab, setEditorTab] = React.useState<"visual" | "json">("visual")
  const [jsonDraft, setJsonDraft] = React.useState("")
  const [jsonError, setJsonError] = React.useState<string | null>(null)
  const [promptImportOpen, setPromptImportOpen] = React.useState(false)
  /** Bumps whenever the prompt import modal opens so the dialog remounts with a fresh form state. */
  const [promptImportSession, setPromptImportSession] = React.useState(0)

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
          ? "Describe what leaves this step. Sync from Input to mirror keys; use {{input.*}} placeholders where helpful."
          : usageContext === "globals"
            ? "Optional tag names and expressions. Each key becomes {{global.key}} for any later step; the same key from a later step overrides earlier values."
            : "Define typed inputs as {{input.*}} on this step and {{prev.*}} from the inbound predecessor when connected."

  /** Keeps the JSON textarea aligned with the latest visual edits whenever the user opens that tab. */
  function handleEditorTabChange({ next }: { next: string }) {
    if (next !== "visual" && next !== "json") return
    setEditorTab(next)
    setJsonError(null)
    if (next === "json") {
      setJsonDraft(serialiseInputSchemaJson({ fields }))
    }
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

  return (
    <div
      className={cn(
        "min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40 shadow-sm",
      )}
    >
      {/* Branding row — mirrors professional API tools (compact header + monospace body below) */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background shadow-sm"
          aria-hidden
        >
          <Braces className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">{resolvedPanelTitle}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{shellSubtitle}</p>
        </div>
        {/* Optional AI import — registry-driven flavours keep this reusable across schema panels */}
        {promptImport ? (
          <SchemaFromPromptImportTrigger
            compact
            onOpen={() => {
              setPromptImportSession((session) => session + 1)
              setPromptImportOpen(true)
            }}
          />
        ) : null}
      </div>

      <div className="space-y-0 px-4 pb-4 pt-3">
        {/* Mode switch — avoids competing with sheet-level tabs by staying small and inset */}
        <Tabs value={editorTab} onValueChange={(v) => handleEditorTabChange({ next: v })} className="w-full gap-3">
          <TabsList className="grid h-9 w-full grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
            <TabsTrigger
              value="visual"
              className="gap-2 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <LayoutList className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Visual
            </TabsTrigger>
            <TabsTrigger
              value="json"
              className="gap-2 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Braces className="size-3.5 shrink-0 opacity-70" aria-hidden />
              JSON
            </TabsTrigger>
          </TabsList>

          {/* Form-style field list */}
          <TabsContent value="visual" className="mt-0 outline-none">
            <InputSchemaEditor
              fields={fields}
              onChange={onChange}
              usageContext={usageContext}
              showHeader={false}
              upstreamPromptTags={upstreamPromptTags}
              contextualPromptTags={contextualPromptTags}
            />
          </TabsContent>

          {/* Raw JSON editor — explicit Apply avoids silent merge surprises */}
          <TabsContent value="json" className="mt-0 space-y-3 outline-none">
            <div className="space-y-2">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Raw schema
              </Label>
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
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">type</code>{" "}
                (string, text, number, boolean, json),{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">required</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">description</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">value</code>{" "}
                (plain text or tag placeholders such as{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{prev.text}}"}</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{input.key}}"}</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{now.iso}}"}</code>; older
                drafts may still list{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">steps.*</code>;{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">defaultValue</code> is merged on
                load).
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

            {/* JSON actions */}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="font-normal" onClick={handleFormatJson}>
                Format
              </Button>
              <Button type="button" size="sm" className="font-normal" onClick={handleApplyJson}>
                Apply to visual editor
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {promptImport ? (
        <SchemaFromPromptDialog
          key={promptImportSession}
          open={promptImportOpen}
          onOpenChange={setPromptImportOpen}
          flavourId={promptImport.flavourId}
          existingFields={fields}
          title={promptImport.dialogTitle}
          description={promptImport.dialogDescription}
          onApply={({ fields: next }) => onChange({ fields: next })}
        />
      ) : null}
    </div>
  )
}
