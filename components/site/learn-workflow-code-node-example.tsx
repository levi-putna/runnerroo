"use client"

import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import { BaseNode, workflowStepShellClassName } from "@/lib/workflows/steps/shared/base-node"

/**
 * Static canvas-style **Run code** card for Learn docs (no React Flow or run context).
 */
export function LearnWorkflowCodeNodeExample() {
  const core = WORKFLOW_NODE_CORE_META.code

  return (
    <div className="not-prose flex justify-center py-2">
      {/* Example node: matches editor canvas chrome */}
      <BaseNode
        icon={<WorkflowNodeGlyph type="code" size="md" />}
        typeBadge={core.typeLabel}
        label="Run code"
        description="Execute JavaScript code in a sandbox environment and return a single result."
        descriptionClassName="line-clamp-3"
        shellClassName={workflowStepShellClassName({ selected: false, runRingClassName: null })}
        accentColor={core.accentBg}
        headerAction={
          <span className="shrink-0 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] font-medium uppercase text-muted-foreground">
            JS
          </span>
        }
      />
    </div>
  )
}
