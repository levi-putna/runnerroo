"use client"

import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"

export type LearnWorkflowStepTitleIconParams = {
  type: string
  entryType?: string
  aiSubtype?: string
  documentSubtype?: string
}

/**
 * Coloured workflow step tile for Learn article headers: same accent frame as the node sheet header.
 */
export function LearnWorkflowStepTitleIcon({
  type,
  entryType,
  aiSubtype,
  documentSubtype,
}: LearnWorkflowStepTitleIconParams) {
  return (
    <WorkflowNodeIconTile
      type={type}
      size="lg"
      stroke="emphasis"
      frameClassName="flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm"
      entryType={entryType}
      aiSubtype={aiSubtype}
      documentSubtype={documentSubtype}
    />
  )
}
