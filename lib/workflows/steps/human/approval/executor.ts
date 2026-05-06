import type { Node } from "@xyflow/react"

import { ApprovalRequiredError } from "@/lib/workflows/engine/approval-required-error"
import { resolveTemplate } from "@/lib/workflows/engine/template"
import { buildApprovalResolutionContext } from "@/lib/workflows/steps/human/approval/context"

export { ApprovalRequiredError }

/**
 * Reads the approval message template from node data: prefer `approvalMessage`, then legacy `reviewerInstructions`.
 */
function readApprovalMessageTemplate(data: Record<string, unknown> | undefined): string {
  const raw =
    typeof data?.approvalMessage === "string" && data.approvalMessage.trim() !== ""
      ? data.approvalMessage.trim()
      : typeof data?.reviewerInstructions === "string" && data.reviewerInstructions.trim() !== ""
        ? data.reviewerInstructions.trim()
        : ""
  return raw
}

/**
 * Pauses the run by throwing {@link ApprovalRequiredError}; persistence creates an inbox approval row.
 *
 * The reviewer-facing message resolves `{{...}}` tags against the inbound envelope plus resolved Input tab
 * fields merged onto `{{input.*}}` / `{{trigger_inputs.*}}` (see {@link buildApprovalResolutionContext}).
 */
export async function executeApprovalStep(params: { node: Node; stepInput: unknown }): Promise<unknown> {
  const { node, stepInput } = params

  const data = node.data as Record<string, unknown> | undefined
  const title = typeof data?.label === "string" ? data.label : "Approval required"
  const description = typeof data?.description === "string" ? data.description : null
  const template = readApprovalMessageTemplate(data)
  let reviewerInstructions: string | null = null
  if (template !== "") {
    const ctx = buildApprovalResolutionContext({ node, stepInput })
    const resolved = resolveTemplate(template, ctx).trim()
    reviewerInstructions = resolved !== "" ? resolved : null
  }

  throw new ApprovalRequiredError({
    nodeId: node.id,
    stepInput,
    title,
    description,
    reviewerInstructions,
  })
}
