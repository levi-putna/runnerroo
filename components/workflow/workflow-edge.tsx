"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react"
import { cn } from "@/lib/utils"

/** Green stroke blended with the canvas background so the executed path reads clearly in light and dark themes. */
const WORKFLOW_RUN_PATH_EDGE_STROKE =
  "color-mix(in oklch, oklch(0.52 0.16 148) 88%, var(--background))"

export type WorkflowEdgeData = {
  label?: string
  /** When true, this edge was followed in the latest workflow run (see run-path helper). */
  onRunPath?: boolean
}

type WorkflowSmoothEdgeProps = EdgeProps & { data?: WorkflowEdgeData }

/**
 * Smooth-step edge: light grey orthogonal path with an optional midpoint pill label only.
 * Forwards marker URL props from React Flow so arrows can indicate edge direction at source or target.
 * Edges with {@link WorkflowEdgeData.onRunPath} render thicker and green to match the runner trace.
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
  markerEnd,
  markerStart,
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
  const onRunPath = Boolean(data?.onRunPath)

  // Stroke weight: default, selected, and executed-run emphasis
  const strokeWidth = onRunPath ? (selected ? 3.5 : 3) : selected ? 2 : 1.25
  const stroke = onRunPath
    ? WORKFLOW_RUN_PATH_EDGE_STROKE
    : selected
      ? "color-mix(in oklch, var(--foreground) 82%, transparent)"
      : "color-mix(in oklch, var(--muted-foreground) 48%, var(--background))"

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          strokeWidth,
          stroke,
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
