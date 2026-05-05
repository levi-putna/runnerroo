"use client"

import type { CSSProperties } from "react"
import { Handle, Position, useNodeConnections } from "@xyflow/react"
import { cn } from "@/lib/utils"

/** Border + hover ring when this handle has at least one edge (in or out, per handle type). */
const HANDLE_CONNECTED_RING =
  "!border-emerald-500/90 hover:!border-emerald-600"

/** Border + hover ring when this handle has no edge on the observed side. */
const HANDLE_DISCONNECTED_RING =
  "!border-red-500/88 hover:!border-red-600/95"

/** Shared geometry for inbound (target) handles — square corners, inset highlight. */
const TARGET_HANDLE_BASE =
  "!size-[10px] !rounded-[2px] !border-[2px] !border-solid !bg-background !shadow-[inset_0_1px_2px_oklch(0_0_0/8%)]"

/** Shared geometry for outbound (source) handles — round, soft lift shadow. */
const SOURCE_HANDLE_BASE =
  "!size-[10px] !rounded-full !border-[2px] !border-solid !bg-background !shadow-[0_1px_3px_oklch(0_0_0/12%)]"

export interface WorkflowTargetHandleProps {
  id?: string
  position: Position
  style?: CSSProperties
  className?: string
}

/**
 * Inbound (target) handle: emerald when at least one edge terminates here, red when none.
 * Square shape so entry handles read differently from round exit handles.
 */
export function WorkflowTargetHandle({
  id,
  position,
  style,
  className,
}: WorkflowTargetHandleProps) {
  const hasExplicitId = id != null && id.length > 0
  const connections = useNodeConnections({
    handleType: "target",
    ...(hasExplicitId ? { handleId: id } : {}),
  })
  const connected = connections.length > 0
  const ring = connected ? HANDLE_CONNECTED_RING : HANDLE_DISCONNECTED_RING

  return (
    <Handle
      id={hasExplicitId ? id : undefined}
      type="target"
      position={position}
      className={cn(TARGET_HANDLE_BASE, ring, className)}
      style={style}
    />
  )
}

export interface WorkflowSourceHandleProps {
  id?: string
  position: Position
  style?: CSSProperties
  className?: string
  /** Optional square source handle (e.g. legacy); default is round like all graph exits. */
  shape?: "round" | "square"
  /**
   * Switch exits use a custom vertical translate; add `runnerroo-handle-switch-exit` so global
   * hover transforms stay aligned (see `globals.css`).
   */
  switchExit?: boolean
}

/**
 * Outbound (source) handle: emerald when an edge leaves this handle, red when none. Round.
 */
export function WorkflowSourceHandle({
  id,
  position,
  style,
  className,
  shape = "round",
  switchExit,
}: WorkflowSourceHandleProps) {
  const hasExplicitId = id != null && id.length > 0
  const connections = useNodeConnections({
    handleType: "source",
    ...(hasExplicitId ? { handleId: id } : {}),
  })
  const connected = connections.length > 0
  const ring = connected ? HANDLE_CONNECTED_RING : HANDLE_DISCONNECTED_RING

  return (
    <Handle
      id={hasExplicitId ? id : undefined}
      type="source"
      position={position}
      className={cn(
        SOURCE_HANDLE_BASE,
        shape === "square" && "!rounded-[2px]",
        ring,
        switchExit && "runnerroo-handle-switch-exit",
        className
      )}
      style={style}
    />
  )
}

/**
 * Standard top target handle for rectangular steps — square, wired / unwired ring colours.
 */
export function InputHandle({ id }: { id?: string }) {
  return (
    <WorkflowTargetHandle
      id={id}
      position={Position.Top}
      style={{ top: -5 }}
    />
  )
}

/**
 * Standard bottom source handle for rectangular steps — round, wired / unwired ring colours.
 */
export function OutputHandle({ id, shape = "round" }: { id?: string; shape?: "round" | "square" }) {
  return (
    <WorkflowSourceHandle
      id={id}
      position={Position.Bottom}
      style={{ bottom: -5 }}
      shape={shape}
    />
  )
}
