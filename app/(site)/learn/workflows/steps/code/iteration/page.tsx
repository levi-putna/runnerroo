import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { iterationDefinition } from "@/lib/workflows/steps/code/iteration/definition"

export const metadata = workflowStepLearnMetadata({ definition: iterationDefinition })

/**
 * Learn: iteration counter step.
 */
export default function LearnWorkflowStepIterationPage() {
  return <WorkflowStepLearnDocPage definition={iterationDefinition} />
}
