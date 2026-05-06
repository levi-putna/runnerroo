"use client"

import type { NodeProps } from "@xyflow/react"

import {
  WORKFLOW_DOCUMENT_FAMILY_META,
  WORKFLOW_DOCUMENT_SUBTYPE_META,
  normaliseDocumentSubtype,
  type WorkflowDocumentSubtype,
} from "@/lib/workflows/engine/node-type-registry"
import { findModelById } from "@/lib/ai-gateway/models"
import { WorkflowNodeGlyph } from "@/components/workflow/node-type-presentation"
import {
  BaseNode,
  useWorkflowNodeRunRingClassName,
  workflowStepShellClassName,
} from "@/lib/workflows/steps/shared/base-node"
import { InputHandle, OutputHandle } from "@/lib/workflows/steps/shared/handles"

export interface WorkflowDocumentNodeData {
  label: string
  description?: string
  subtype?: WorkflowDocumentSubtype
  model?: string
  [key: string]: unknown
}

/**
 * Canvas card for document steps — template fill vs docxml-from-model variants share one React Flow `type`.
 */
export function WorkflowDocumentNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WorkflowDocumentNodeData
  const subtype = normaliseDocumentSubtype({ value: nodeData.subtype })
  const row = WORKFLOW_DOCUMENT_SUBTYPE_META[subtype]
  const description =
    typeof nodeData.description === "string"
      ? nodeData.description
      : nodeData.description != null
        ? String(nodeData.description)
        : ""

  const metadataRows =
    subtype === "docxml" ? buildDocXmlCanvasMetadataRows({ model: nodeData.model }) : []

  const runRing = useWorkflowNodeRunRingClassName(id)
  const shellClassName = workflowStepShellClassName({ selected, runRingClassName: runRing })

  return (
    <>
      {/* Incoming workflow payload */}
      <InputHandle />
      {/* Node card body */}
      <BaseNode
        icon={<WorkflowNodeGlyph type="document" documentSubtype={subtype} size="md" />}
        typeBadge={row.canvasBadge}
        label={nodeData.label || row.defaultLabel}
        description={description}
        shellClassName={shellClassName}
        accentColor={WORKFLOW_DOCUMENT_FAMILY_META.accentBg}
      >
        {/* Footer metadata — docxml surfaces chosen gateway model */}
        {metadataRows.length > 0 ? (
          <>
            <div className="h-px w-full bg-border/80" aria-hidden />
            <div className="px-3 pb-3 pt-2">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Metadata
              </p>
              {/* Label / value pairs */}
              <dl className="min-w-0 space-y-2 text-xs">
                {metadataRows.map((item) => (
                  <div
                    key={item.label}
                    className="flex min-w-0 items-start justify-between gap-x-3 gap-y-0.5 text-left"
                  >
                    <dt className="max-w-[40%] shrink-0 truncate text-muted-foreground">{item.label}</dt>
                    <dd className="min-w-0 flex-1 break-words text-right font-medium text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        ) : null}
      </BaseNode>
      {/* Outgoing generated document payload */}
      <OutputHandle />
    </>
  )
}

/**
 * Builds footer rows for the docxml document variant — drops blank values after trim.
 */
function buildDocXmlCanvasMetadataRows({ model }: { model?: string }): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const modelId = typeof model === "string" ? model.trim() : ""

  if (modelId.length > 0) {
    const catalogued = findModelById(modelId)
    const display = catalogued?.shortName ?? modelId
    if (display.trim().length > 0) {
      out.push({ label: "Model", value: display })
    }
  }

  return out
}
