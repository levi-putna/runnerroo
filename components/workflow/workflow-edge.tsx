"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react"
import { cn } from "@/lib/utils"

export type WorkflowEdgeData = {
  label?: string
}

type WorkflowSmoothEdgeProps = EdgeProps & { data?: WorkflowEdgeData }

/**
 * Smooth-step edge: light grey orthogonal path with an optional midpoint pill label only.
 */
export function WorkflowSmoothEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: WorkflowSmoothEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  })

  const text = data?.label?.trim()

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 2 : 1.25,
          stroke: selected
            ? "color-mix(in oklch, var(--foreground) 82%, transparent)"
            : "color-mix(in oklch, var(--muted-foreground) 48%, var(--background))",
        }}
      />
      {/* Optional pill only — EdgeLabelRenderer per React Flow edge label docs */}
      {text ? (
        <EdgeLabelRenderer>
          <div
            className="nopan nodrag pointer-events-none"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <span
              className={cn(
                "rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                "border-primary/35 bg-background/95 text-primary shadow-sm"
              )}
            >
              {text}
            </span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
