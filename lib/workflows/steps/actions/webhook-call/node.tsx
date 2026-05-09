"use client"

import type { NodeProps } from "@xyflow/react"
import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"

export interface WebhookCallNodeData {
  label: string
  description?: string
  method?: string
  url?: string
  [key: string]: unknown
}

/** Method + URL rows for the canvas footer when at least one value is present after trim. */
function buildWebhookCallMetadataRows(p: {
  method?: string
  url?: string
}): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const method = typeof p.method === "string" ? p.method.trim().toUpperCase() : ""
  if (method.length > 0) {
    out.push({ label: "Method", value: method })
  }
  const url = typeof p.url === "string" ? p.url.trim() : ""
  if (url.length > 0) {
    const display = url.length > 48 ? `${url.slice(0, 45)}…` : url
    out.push({ label: "URL", value: display })
  }
  return out
}

/**
 * HTTP outbound step — single input and output; shows method and URL summary on the canvas when set.
 */
export function WebhookCallNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WebhookCallNodeData
  const core = WORKFLOW_NODE_CORE_META.webhookCall
  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })
  const metadataRows = buildWebhookCallMetadataRows({
    method: nodeData.method,
    url: nodeData.url,
  })

  return (
    <>
      <InputHandle />
      <BaseNode
        icon={<WorkflowNodeGlyph type="webhookCall" size="md" />}
        typeBadge={core.typeLabel}
        label={nodeData.label || "Webhook"}
        description={nodeData.description}
        shellClassName={shellClassName}
        accentColor={core.accentBg}
      >
        {/* Footer — request line hints when URL or method is configured */}
        {metadataRows.length > 0 ? (
          <>
            <div className="h-px w-full bg-border/80" aria-hidden />
            <div className="px-3 pb-3 pt-2">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Request
              </p>
              <dl className="min-w-0 space-y-2 text-xs">
                {metadataRows.map((item) => (
                  <div
                    key={item.label}
                    className="flex min-w-0 items-start justify-between gap-x-3 gap-y-0.5 text-left"
                  >
                    <dt className="max-w-[40%] shrink-0 truncate text-muted-foreground">{item.label}</dt>
                    <dd className="min-w-0 flex-1 break-all text-right font-medium text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        ) : null}
      </BaseNode>
      <OutputHandle />
    </>
  )
}
