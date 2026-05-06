"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  WORKFLOW_GLYPH_SIZE_CLASSES,
  resolveWorkflowNodeTilePresentation,
  type WorkflowGlyphSize,
  type WorkflowGlyphStroke,
} from "@/lib/workflows/engine/node-type-registry"

export interface WorkflowNodeGlyphProps {
  type: string
  size?: WorkflowGlyphSize
  stroke?: WorkflowGlyphStroke
  className?: string
  entryType?: string | null
  aiSubtype?: string | null
  documentSubtype?: string | null
}

const GLYPH_STROKE_WIDTH: Record<WorkflowGlyphStroke, number> = {
  default: 2,
  emphasis: 2.25,
}

/**
 * Renders only the Lucide glyph (no coloured frame). Use inside tiles or standalone when size matters.
 */
export function WorkflowNodeGlyph({
  type,
  size = "md",
  stroke = "default",
  className,
  entryType,
  aiSubtype,
  documentSubtype,
}: WorkflowNodeGlyphProps) {
  const p = resolveWorkflowNodeTilePresentation({ type, entryType, aiSubtype, documentSubtype })
  const Icon = p.Icon
  const dim = WORKFLOW_GLYPH_SIZE_CLASSES[size]

  return (
    <Icon
      className={cn(dim, "shrink-0 text-white", p.glyphClassName, className)}
      strokeWidth={GLYPH_STROKE_WIDTH[stroke]}
      aria-hidden
    />
  )
}

export interface WorkflowNodeIconTileProps {
  type: string
  /** Pixel-ish tile: canvas step header */
  size?: WorkflowGlyphSize
  stroke?: WorkflowGlyphStroke
  /** Frame around the glyph (rounded square, sheet header, etc.). */
  frameClassName: string
  glyphClassName?: string
  entryType?: string | null
  aiSubtype?: string | null
  documentSubtype?: string | null
}

/**
 * Coloured tile wrapping the standard node glyph — use wherever the square icon outline should appear.
 */
export function WorkflowNodeIconTile({
  type,
  size = "md",
  stroke = "default",
  frameClassName,
  glyphClassName,
  entryType,
  aiSubtype,
  documentSubtype,
}: WorkflowNodeIconTileProps) {
  const p = resolveWorkflowNodeTilePresentation({ type, entryType, aiSubtype, documentSubtype })

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center text-white shadow-inner",
        p.accentBg,
        frameClassName,
      )}
    >
      {/* Glyph — centred inside the accent tile */}
      <WorkflowNodeGlyph
        type={type}
        size={size}
        stroke={stroke}
        className={glyphClassName}
        entryType={entryType}
        aiSubtype={aiSubtype}
        documentSubtype={documentSubtype}
      />
    </div>
  )
}
