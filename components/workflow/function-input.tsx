"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Mention } from "@tiptap/extension-mention"
import { mergeAttributes } from "@tiptap/core"
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion"
import { GripVertical, SquareFunction } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"

const PROMPT_TAG_DRAG_MIME = "application/x-runnerroo-prompt-tag"

/** Must match `Mention.configure({ suggestion: { char } })` — stored on each node so TipTap does not fall back to its default `@`. */
const PROMPT_TAG_TRIGGER = "{{"

// ─── Value helpers ─────────────────────────────────────────────────────────────

type TipTapNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
}

/**
 * Attributes for a prompt mention node — includes `mentionSuggestionChar` so
 * TipTap’s internal handlers (e.g. Backspace) do not use the extension default `@`.
 */
function buildPromptMentionAttrs({ id, label }: { id: string; label: string }) {
  return { id, label, mentionSuggestionChar: PROMPT_TAG_TRIGGER }
}

/**
 * Convert a plain-text prompt string (with `{{id}}` placeholders) to a TipTap
 * doc JSON object. Each `\n` becomes a new paragraph node.
 */
function parsePlainText(text: string, tags: PromptTagDefinition[]): object {
  if (!text) return { type: "doc", content: [{ type: "paragraph" }] }

  const lines = text.split("\n")
  const content = lines.map((line) => {
    const parts: TipTapNode[] = []
    const regex = /\{\{([^}]+)\}\}/g
    let last = 0
    let m: RegExpExecArray | null

    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push({ type: "text", text: line.slice(last, m.index) })
      const id = m[1]
      const tag = tags.find((t) => t.id === id)
      parts.push({ type: "mention", attrs: buildPromptMentionAttrs({ id, label: tag?.label ?? id }) })
      last = m.index + m[0].length
    }

    if (last < line.length) parts.push({ type: "text", text: line.slice(last) })
    return { type: "paragraph", content: parts }
  })

  return { type: "doc", content }
}

/**
 * Serialize TipTap doc JSON back to a plain-text string. Mention nodes become
 * `{{id}}` and paragraphs are joined with `\n`.
 */
function serializeToPlainText(json: { content?: TipTapNode[] }): string {
  return (json.content ?? [])
    .map((para) =>
      (para.content ?? [])
        .map((node) => {
          if (node.type === "text") return node.text ?? ""
          if (node.type === "mention") return `{{${String(node.attrs?.id ?? "")}}}`
          return ""
        })
        .join(""),
    )
    .join("\n")
}

// ─── Suggestion popup ──────────────────────────────────────────────────────────

interface SuggestionState {
  items: PromptTagDefinition[]
  selectedIndex: number
  /** Cursor-relative bounding rect, refreshed on each update tick. */
  rect: DOMRect | null
  command: ((item: PromptTagDefinition) => void) | null
}

interface SuggestionListProps {
  items: PromptTagDefinition[]
  selectedIndex: number
  rect: DOMRect | null
  onSelect: (item: PromptTagDefinition) => void
}

/**
 * Floating autocomplete list, rendered via React portal at `document.body` so it
 * is never clipped by `overflow: hidden` ancestors.
 */
function SuggestionList({ items, selectedIndex, rect, onSelect }: SuggestionListProps) {
  if (!rect || items.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 4,
        zIndex: 200,
        minWidth: 240,
        maxWidth: 380,
      }}
      className="overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <ul className="m-0 max-h-72 list-none overflow-y-auto p-0 py-1">
        {items.map((item, idx) => (
          <li key={item.id} className="border-b border-border/50 last:border-b-0">
            {/* onMouseDown so the editor doesn't lose focus before we insert */}
            <button
              type="button"
              className={cn(
                "w-full cursor-pointer px-3 py-2 text-left",
                idx === selectedIndex ? "bg-accent" : "hover:bg-accent/50",
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(item)
              }}
            >
              <span className="block truncate font-mono text-xs font-semibold text-[var(--purple)]">
                {`{{${item.id}}}`}
              </span>
              <span className="block truncate text-xs font-medium text-foreground">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground line-clamp-2">
                  {item.description}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Single editor instance ────────────────────────────────────────────────────

interface FunctionInputEditorProps {
  value: string
  onChange: (plain: string) => void
  tags: PromptTagDefinition[]
  disabled?: boolean
  readOnly?: boolean
  placeholder?: string
  className?: string
  rows?: number
  /** Mutable ref that receives a function to insert a tag at the current cursor. */
  insertTagRef?: React.MutableRefObject<((tagId: string) => void) | null>
  /** Receives the TipTap {@link Editor} instance when mounted (dialog shell focus). */
  editorRef?: React.MutableRefObject<Editor | null>
}

/**
 * A single TipTap editor that reads/writes plain text with `{{tag}}` placeholders.
 * Used both for the inline field and for the expanded expression dialog.
 */
function FunctionInputEditor({
  value,
  onChange,
  tags,
  disabled,
  readOnly,
  placeholder,
  className,
  rows = 4,
  insertTagRef,
  editorRef,
}: FunctionInputEditorProps) {
  /**
   * Latest tag catalogue for drag-drop and imperative insert — avoids stale lookups when the
   * editor instance was created against an older `tags` prop snapshot.
   */
  const tagsRef = React.useRef(tags)
  React.useEffect(() => {
    tagsRef.current = tags
  }, [tags])

  // ─── Suggestion state ──────────────────────────────────────────────────────
  const [suggestionState, setSuggestionState] = React.useState<SuggestionState | null>(null)

  // Keep a ref in sync so the onKeyDown closure (which runs outside React render)
  // always reads the latest state without a stale closure.
  const suggestionStateRef = React.useRef<SuggestionState | null>(null)
  const updateSuggestion = React.useCallback((next: SuggestionState | null) => {
    setSuggestionState(next)
    suggestionStateRef.current = next
  }, [])

  // Handlers that delegate to React state — stored in a ref so they can be
  // referenced from the stable TipTap suggestion config without recreating the editor.
  const handlersRef = React.useRef<{
    onStart: (p: SuggestionProps<PromptTagDefinition>) => void
    onUpdate: (p: SuggestionProps<PromptTagDefinition>) => void
    onExit: () => void
    onKeyDown: (p: SuggestionKeyDownProps) => boolean
  }>({
    onStart: () => {},
    onUpdate: () => {},
    onExit: () => {},
    onKeyDown: () => false,
  })

  // Set the real handlers once (after mount so updateSuggestion is stable).
  React.useEffect(() => {
    handlersRef.current = {
      onStart(p) {
        updateSuggestion({
          items: p.items,
          selectedIndex: 0,
          rect: p.clientRect?.() ?? null,
          command: p.command,
        })
      },
      onUpdate(p) {
        const prev = suggestionStateRef.current
        updateSuggestion(
          prev
            ? { ...prev, items: p.items, rect: p.clientRect?.() ?? null, command: p.command }
            : null,
        )
      },
      onExit() {
        updateSuggestion(null)
      },
      onKeyDown({ event }) {
        const s = suggestionStateRef.current
        if (!s || s.items.length === 0) return false

        if (event.key === "ArrowDown") {
          updateSuggestion({ ...s, selectedIndex: Math.min(s.selectedIndex + 1, s.items.length - 1) })
          return true
        }
        if (event.key === "ArrowUp") {
          updateSuggestion({ ...s, selectedIndex: Math.max(s.selectedIndex - 1, 0) })
          return true
        }
        if (event.key === "Enter") {
          const item = s.items[s.selectedIndex]
          if (item && s.command) s.command(item)
          return true
        }
        if (event.key === "Escape") {
          updateSuggestion(null)
          return true
        }
        return false
      },
    }
  }, [updateSuggestion])

  // ─── TipTap editor ────────────────────────────────────────────────────────
  // Track the last value we set externally to detect changes coming FROM outside.
  const externalValueRef = React.useRef(value)

  const editor = useEditor({
    // Next.js renders on the server first — defer first paint until mount so the
    // client DOM matches and hydration does not mismatch (TipTap requirement).
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({ placeholder: placeholder ?? "Write your prompt…" }),
      Mention.configure({
        HTMLAttributes: { class: "prompt-mention-chip" },
        /** Remove the whole token on Backspace — do not leave `@` (TipTap’s default trigger char). */
        deleteTriggerWithBackspace: true,
        renderText({ node }) {
          return `{{${String(node.attrs.id ?? "")}}}`
        },
        renderHTML({ node }) {
          return [
            "span",
            mergeAttributes(
              { class: "prompt-mention-chip", "data-id": node.attrs.id as string },
            ),
            `{{${node.attrs.id as string}}}`,
          ]
        },
        suggestion: {
          char: PROMPT_TAG_TRIGGER,
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }: { query: string }) => {
            const q = query.trim().toLowerCase()
            return tags.filter(
              (t) => !q || t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
            )
          },
          // Delegate to the stable handlersRef so state updates don't require
          // tearing down and recreating the editor.
          render: () => ({
            onStart: (p: SuggestionProps<PromptTagDefinition>) => handlersRef.current.onStart(p),
            onUpdate: (p: SuggestionProps<PromptTagDefinition>) => handlersRef.current.onUpdate(p),
            onExit: () => handlersRef.current.onExit(),
            onKeyDown: (p: SuggestionKeyDownProps) => handlersRef.current.onKeyDown(p),
          }),
          // Replace the `{{query` range with a proper mention node.
          command: ({ editor: ed, range, props }) => {
            const tag = props as unknown as PromptTagDefinition
            ed
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: "mention", attrs: buildPromptMentionAttrs({ id: tag.id, label: tag.label }) },
                { type: "text", text: " " },
              ])
              .run()
          },
        },
      }),
    ],
    content: parsePlainText(value, tags),
    editable: !disabled && !readOnly,
    onUpdate({ editor: ed }) {
      const plain = serializeToPlainText(ed.getJSON() as { content?: TipTapNode[] })
      externalValueRef.current = plain
      onChange(plain)
    },
  }, [tags])

  // Sync external value changes into the editor (e.g. parent resets the prompt).
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (value === externalValueRef.current) return
    externalValueRef.current = value
    // emitUpdate: false prevents an echo loop back to the parent.
    editor.commands.setContent(parsePlainText(value, tags), { emitUpdate: false })
  }, [value, editor, tags])

  // Update editable state without recreating the editor.
  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && !readOnly, false)
  }, [editor, disabled, readOnly])

  // Expose an imperative insert-tag function for the tag palette.
  React.useEffect(() => {
    if (!insertTagRef) return
    insertTagRef.current = (tagId: string) => {
      if (!editor || editor.isDestroyed) return
      const tag = tagsRef.current.find((t) => t.id === tagId)
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mention",
          attrs: buildPromptMentionAttrs({ id: tagId, label: tag?.label ?? tagId }),
        })
        .run()
    }
    return () => {
      if (insertTagRef) insertTagRef.current = null
    }
  }, [editor, insertTagRef])

  React.useEffect(() => {
    if (!editorRef) return
    editorRef.current = editor ?? null
    return () => {
      if (editorRef.current === editor) editorRef.current = null
    }
  }, [editor, editorRef])

  // ─── Drag-and-drop ────────────────────────────────────────────────────────
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const tagId = event.dataTransfer.getData(PROMPT_TAG_DRAG_MIME)
    if (!tagId || !editor) return
    event.preventDefault()
    const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    const tag = tagsRef.current.find((t) => t.id === tagId)
    editor
      .chain()
      .focus()
      .insertContentAt(pos?.pos ?? editor.state.doc.content.size, {
        type: "mention",
        attrs: buildPromptMentionAttrs({ id: tagId, label: tag?.label ?? tagId }),
      })
      .run()
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer.types).includes(PROMPT_TAG_DRAG_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    }
  }

  const minHeight = `calc(${rows} * 1.5em + 1.25rem)`

  const shellStyle = React.useMemo(
    () =>
      ({
        minHeight,
        "--function-input-min-height": minHeight,
      }) as React.CSSProperties,
    [minHeight],
  )

  /**
   * Delegates clicks on non-editable chrome (wrapper padding gaps, viewport
   * below short content, etc.) to TipTap via focus — same behaviour as tapping
   * empty space in the expression dialog column.
   */
  const handleFocusSurfacePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || readOnly || event.button !== 0) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('[data-slot="scroll-area-scrollbar"]')) return
      const surface = event.currentTarget
      const proseMirror = surface.querySelector(".ProseMirror")
      if (proseMirror?.contains(target)) return
      if (!editor || editor.isDestroyed) return
      event.preventDefault()
      editor.chain().focus("end").run()
    },
    [disabled, readOnly, editor],
  )

  return (
    <>
      <div
        className="function-input-editor-focus-surface cursor-text"
        style={shellStyle}
        onPointerDown={handleFocusSurfacePointerDown}
      >
        <EditorContent
          editor={editor}
          className={cn("function-input-editor-content", className)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      </div>
      {/* Suggestion popup — portalled to body to escape any overflow:hidden parent */}
      {suggestionState && typeof document !== "undefined" &&
        createPortal(
          <SuggestionList
            items={suggestionState.items}
            selectedIndex={suggestionState.selectedIndex}
            rect={suggestionState.rect}
            onSelect={(item) => {
              if (suggestionState.command) suggestionState.command(item)
            }}
          />,
          document.body,
        )}
    </>
  )
}

// ─── Public component ──────────────────────────────────────────────────────────

export type FunctionInputProps = {
  /** Available tag tokens with id, label, and description. */
  tags: PromptTagDefinition[]
  /** Plain-text value including `{{tag_id}}` placeholders. */
  value: string
  onChange: ({ value }: { value: string }) => void
  /** Changes when the editing context switches (e.g. different workflow node). Forces a fresh editor. */
  fieldInstanceId: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  rows?: number
  className?: string
  id?: string
  /** Modal title for the expanded editor (n8n-style expression panel). */
  expressionDialogTitle?: string
  /** Optional description below the modal title. */
  expressionDialogDescription?: React.ReactNode
}

/**
 * Multi-line “function” input built on TipTap: literals plus `{{tag}}` expressions,
 * autocomplete, chips, and an expanded expression dialog with a tag palette.
 * The dialog edits a draft; only **Apply** writes through to {@link onChange}. Closing
 * or **Cancel** discards dialog edits so the inline field stays unchanged.
 */
export function FunctionInput({
  tags,
  value,
  onChange,
  fieldInstanceId,
  placeholder,
  disabled,
  readOnly,
  rows = 4,
  className,
  id,
  expressionDialogTitle,
  expressionDialogDescription,
}: FunctionInputProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  /** Draft text while the expression dialog is open; commits to {@link value} only when Apply is used. */
  const [dialogDraft, setDialogDraft] = React.useState("")
  const inlineInsertTagRef = React.useRef<((tagId: string) => void) | null>(null)
  const dialogInsertTagRef = React.useRef<((tagId: string) => void) | null>(null)
  const dialogEditorRef = React.useRef<Editor | null>(null)

  const handleChange = React.useCallback(
    (plain: string) => onChange({ value: plain }),
    [onChange],
  )

  const handleDialogOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) {
        setDialogDraft(value)
      }
      setDialogOpen(next)
    },
    [value],
  )

  const handleApplyDialog = React.useCallback(() => {
    onChange({ value: dialogDraft })
    setDialogOpen(false)
  }, [onChange, dialogDraft])

  return (
    <div id={id} className={cn("group relative min-w-0 w-full", className)}>
      {/* Shell — inline editor + trailing expression (fx) trigger */}
      <div
        className={cn(
          "flex min-h-0 w-full overflow-hidden rounded-lg border border-input bg-transparent transition-[color,box-shadow] outline-none",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {/* Inline editor */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <FunctionInputEditor
            key={`inline-${fieldInstanceId}`}
            value={value}
            onChange={handleChange}
            tags={tags}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            rows={rows}
            insertTagRef={inlineInsertTagRef}
            className="rounded-none border-0 bg-transparent shadow-none [&_.ProseMirror]:px-2.5 [&_.ProseMirror]:py-2"
          />
        </div>

        {/* Trailing fx — opens expanded expression UI */}
        <Separator orientation="vertical" />
        <div className="flex shrink-0 bg-muted/25">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || readOnly}
            className="h-auto min-h-10 w-11 shrink-0 rounded-none text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            title="Open expression editor"
            aria-label="Open expression editor"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleDialogOpenChange(true)}
          >
            <SquareFunction className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Expanded dialog — drafts locally until Apply; closing or Cancel discards edits. */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton
          className="flex h-[min(88vh,880px)] w-[min(96vw,1120px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          {/* Header */}
          <DialogHeader className="shrink-0 border-b px-5 py-4">
            <DialogTitle>{expressionDialogTitle ?? "Expression editor"}</DialogTitle>
            <DialogDescription>
              {expressionDialogDescription ?? (
                <>
                  Type {"{{"} to insert a tag, or drag a tag from the list. Choose Apply to save your
                  changes; closing the dialog without applying leaves the field as it was.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr_min(320px,40%)]">
            {/* Editor column */}
            <div className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r">
              <ScrollArea className="min-h-0 flex-1">
                {dialogOpen ? (
                  /* Mount only while open so the inline editor is the sole TipTap instance for mentions. */
                  <FunctionInputEditor
                    key={`dialog-${fieldInstanceId}`}
                    value={dialogDraft}
                    onChange={setDialogDraft}
                    tags={tags}
                    disabled={disabled}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    rows={20}
                    insertTagRef={dialogInsertTagRef}
                    editorRef={dialogEditorRef}
                    className="[&_.ProseMirror]:box-border [&_.ProseMirror]:p-4"
                  />
                ) : null}
              </ScrollArea>
            </div>

            {/* Tag palette */}
            <div className="flex min-h-0 flex-col bg-muted/20">
              <div className="shrink-0 border-b px-4 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tags
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Drag into the editor or double-click to insert
                </p>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-3">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No tags available for this context.
                    </p>
                  ) : (
                    tags.map((tag) => (
                      <TagPaletteCard
                        key={tag.id}
                        tag={tag}
                        onInsert={() => {
                          dialogInsertTagRef.current?.(tag.id)
                        }}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 px-5 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={disabled || readOnly} onClick={handleApplyDialog}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tag palette card ──────────────────────────────────────────────────────────

export interface TagPaletteCardProps {
  tag: PromptTagDefinition
  onInsert: () => void
}

/**
 * Draggable tag card in the expanded dialog palette.
 */
function TagPaletteCard({ tag, onInsert }: TagPaletteCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PROMPT_TAG_DRAG_MIME, tag.id)
        e.dataTransfer.effectAllowed = "copy"
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onInsert()
        }
      }}
      onDoubleClick={() => onInsert()}
      className={cn(
        "flex cursor-grab gap-2 rounded-lg border border-border/80 bg-card p-2.5 text-left shadow-sm",
        "active:cursor-grabbing hover:border-ring/60 hover:bg-accent/40",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    >
      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-mono text-xs font-semibold text-[var(--purple)]">{`{{${tag.id}}}`}</p>
        <p className="text-xs font-medium leading-tight text-foreground">{tag.label}</p>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {tag.description}
        </p>
      </div>
    </div>
  )
}
