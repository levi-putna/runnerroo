"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Copy, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type WorkflowNodeContextMenuProps = {
  open: boolean
  x: number
  y: number
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/**
 * Portaled, cursor-positioned menu for workflow canvas nodes (edit, duplicate, and delete).
 */
export function WorkflowNodeContextMenu({
  open,
  x,
  y,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: WorkflowNodeContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as globalThis.Node)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[9999] min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{ left: x, top: y }}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
    >
      <button
        type="button"
        role="menuitem"
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        )}
        onClick={() => {
          onEdit()
          onClose()
        }}
      >
        <Pencil className="size-3.5 shrink-0 opacity-70" />
        Edit
      </button>
      <div className="my-1 h-px bg-muted" role="separator" />
      <button
        type="button"
        role="menuitem"
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        )}
        onClick={() => {
          onDuplicate()
          onClose()
        }}
      >
        <Copy className="size-3.5 shrink-0 opacity-70" />
        Duplicate
      </button>
      <div className="my-1 h-px bg-muted" role="separator" />
      <button
        type="button"
        role="menuitem"
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
          "text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
        )}
        onClick={() => {
          onDelete()
          onClose()
        }}
      >
        <Trash2 className="size-3.5 shrink-0 opacity-70" />
        Delete
      </button>
    </div>,
    document.body
  )
}
