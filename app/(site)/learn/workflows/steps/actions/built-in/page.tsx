import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { actionDefinition } from "@/lib/workflows/steps/actions/action/definition"

export const metadata = workflowStepLearnMetadata({ definition: actionDefinition })

/**
 * Learn: built-in action step.
 */
export default function LearnWorkflowStepActionPage() {
  return <WorkflowStepLearnDocPage definition={actionDefinition} />
}
