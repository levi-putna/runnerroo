/**
 * Raised by the approval workflow step executor to pause traversal until an operator responds.
 */

export interface ApprovalRequiredErrorParams {
  nodeId: string
  /** Inbound envelope at the approval node (stored for resume merge). */
  stepInput: unknown
  /** Short headline for the inbox row. */
  title: string
  /** Optional body copy surfaced in inbox / run UI. */
  description?: string | null
  /** Longer guidance for the reviewer (Inbox detail). */
  reviewerInstructions?: string | null
}

/**
 * Signals that graph traversal must stop at this node pending human approval.
 */
export class ApprovalRequiredError extends Error {
  readonly nodeId: string

  readonly stepInput: unknown

  readonly title: string

  readonly description: string | null

  readonly reviewerInstructions: string | null

  constructor({ nodeId, stepInput, title, description, reviewerInstructions }: ApprovalRequiredErrorParams) {
    super("Workflow approval required")
    this.name = "ApprovalRequiredError"
    this.nodeId = nodeId
    this.stepInput = stepInput
    this.title = title
    this.description = description ?? null
    this.reviewerInstructions = reviewerInstructions ?? null
  }
}

/**
 * Type guard for {@link ApprovalRequiredError} across bundle boundaries where `instanceof` may fail.
 */
export function isApprovalRequiredError(value: unknown): value is ApprovalRequiredError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ApprovalRequiredError).name === "ApprovalRequiredError"
  )
}
