"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { autocompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete"
import type { EditorView } from "@codemirror/view"
import { xcodeDark, xcodeLight } from "@uiw/codemirror-theme-xcode"
import { Maximize2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"

/** Approximate line box height for the inline sheet editor (px), tuned for `text-[12px]` + line numbers. */
const INLINE_LINE_HEIGHT_PX = 18
/** Vertical chrome inside the editor (padding / horizontal gutter reserve). */
const INLINE_EDITOR_CHROME_PX = 14
const DEFAULT_INLINE_MIN_ROWS = 4
const DEFAULT_INLINE_MAX_ROWS = 28

/**
 * Pixel height for the inline CodeMirror so the card grows with logical line count and caps before scrolling internally.
 */
function computeInlineEditorHeightPx({
  value,
  minRows,
  maxRows,
}: {
  value: string
  minRows: number
  maxRows: number
}): number {
  const rawLines = value.length === 0 ? 1 : value.split("\n").length
  const rows = Math.min(maxRows, Math.max(minRows, rawLines))
  return rows * INLINE_LINE_HEIGHT_PX + INLINE_EDITOR_CHROME_PX
}

export interface WorkflowCodeEditorParams {
  /** Current source (may include `{{…}}` placeholders). */
  value: string
  /** Persist next source. */
  onChange: ({ value }: { value: string }) => void
  /** Tags offered when typing `{{` (same ids as {@link ExpressionInput}). */
  tags: PromptTagDefinition[]
  /** Stable id for CodeMirror `key` when remounting is required. */
  fieldInstanceId: string
  /** Optional extra classes on the outer shell (border wraps toolbar + editor). */
  className?: string
  /** Toolbar and fullscreen layer heading. */
  fullscreenTitle?: string
  /** Minimum logical rows shown in the sheet editor (before internal scroll). */
  inlineMinRows?: number
  /** Maximum logical rows shown in the sheet editor (extra lines scroll inside the editor). */
  inlineMaxRows?: number
}

/**
 * Workflow code field: CodeMirror 6 with Xcode light/dark themes, `{{` tag completion, and a custom fullscreen layer.
 */
export function WorkflowCodeEditor({
  value,
  onChange,
  tags,
  fieldInstanceId,
  className,
  fullscreenTitle = "Edit code",
  inlineMinRows = DEFAULT_INLINE_MIN_ROWS,
  inlineMaxRows = DEFAULT_INLINE_MAX_ROWS,
}: WorkflowCodeEditorParams) {
  const [fullOpen, setFullOpen] = React.useState(false)
  const [docDark, setDocDark] = React.useState(false)

  const inlineHeightPx = React.useMemo(
    () =>
      computeInlineEditorHeightPx({
        value,
        minRows: inlineMinRows,
        maxRows: inlineMaxRows,
      }),
    [value, inlineMinRows, inlineMaxRows],
  )

  React.useEffect(() => {
    const root = document.documentElement
    const read = () => setDocDark(root.classList.contains("dark"))
    read()
    const obs = new MutationObserver(read)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  React.useEffect(() => {
    if (!fullOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [fullOpen])

  React.useEffect(() => {
    if (!fullOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFullOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [fullOpen])

  const themeExtension = docDark ? xcodeDark : xcodeLight

  const completionExtension = React.useMemo(
    () =>
      autocompletion({
        override: [buildWorkflowCodeTagSource({ tags })],
      }),
    [tags],
  )

  const extensions = React.useMemo(
    () => [javascript(), completionExtension],
    [completionExtension],
  )

  const basicSetup = React.useMemo(
    () => ({
      lineNumbers: true,
      foldGutter: true,
      highlightActiveLine: true,
    }),
    [],
  )

  const fullscreenLayer =
    fullOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-label={fullscreenTitle}
          >
            {/* Top bar — title + close */}
            <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
              <h2 className="min-w-0 truncate text-left text-sm font-semibold text-foreground">{fullscreenTitle}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setFullOpen(false)}
                aria-label="Close full screen editor"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </header>
            {/* Editor fills the viewport below the bar */}
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
                <CodeMirror
                  key={`${fieldInstanceId}-fs-${docDark ? "d" : "l"}`}
                  value={value}
                  height="100%"
                  theme={themeExtension}
                  extensions={extensions}
                  className="h-full min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-snug"
                  onChange={(next) => onChange({ value: next })}
                  basicSetup={basicSetup}
                  autoFocus
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-md border border-border bg-background", className)}>
      {/* Toolbar — title + full screen */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-2 sm:px-3">
        <span className="min-w-0 truncate text-left text-xs font-medium text-foreground sm:text-sm">{fullscreenTitle}</span>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setFullOpen(true)}>
          <Maximize2 className="size-3.5" aria-hidden />
          Full screen
        </Button>
      </div>

      {/* Inline editor — height tracks logical line count (capped) */}
      <div className="min-h-0 overflow-hidden" style={{ height: inlineHeightPx }}>
        <CodeMirror
          key={`${fieldInstanceId}-inline-${docDark ? "d" : "l"}`}
          value={value}
          height={`${inlineHeightPx}px`}
          theme={themeExtension}
          extensions={extensions}
          className="font-mono text-[12px] leading-snug"
          onChange={(next) => onChange({ value: next })}
          basicSetup={basicSetup}
        />
      </div>

      {fullscreenLayer}
    </div>
  )
}

/**
 * Builds a CodeMirror completion source for incomplete `{{…` segments.
 */
function buildWorkflowCodeTagSource({ tags }: { tags: PromptTagDefinition[] }) {
  return function workflowCodeTagCompletions(context: CompletionContext) {
    const match = context.matchBefore(/\{\{[^}]*$/)
    if (!match) return null
    const from = match.from
    const to = context.pos
    const typed = match.text.slice(2).trim().toLowerCase()
    const filtered =
      typed === ""
        ? tags
        : tags.filter(
            (t) =>
              t.id.toLowerCase().includes(typed) ||
              t.label.toLowerCase().includes(typed) ||
              t.description.toLowerCase().includes(typed),
          )
    return {
      from,
      to,
      options: filtered.map((t) => ({
        label: t.id,
        detail: t.label,
        info: t.description,
        apply(view: EditorView, _completion: Completion, f: number, t2: number) {
          const insert = `{{${t.id}}}`
          view.dispatch({ changes: { from: f, to: t2, insert } })
        },
      })),
    }
  }
}
