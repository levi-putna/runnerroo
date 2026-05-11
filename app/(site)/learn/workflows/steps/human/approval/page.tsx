import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { approvalDefinition } from "@/lib/workflows/steps/human/approval/definition"

export const metadata = workflowStepLearnMetadata({ definition: approvalDefinition })

/**
 * Learn: human approval step.
 */
export default function LearnWorkflowStepApprovalPage() {
  return <WorkflowStepLearnDocPage definition={approvalDefinition} />
}
