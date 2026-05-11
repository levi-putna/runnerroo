import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { endDefinition } from "@/lib/workflows/steps/termination/end/definition"

export const metadata = workflowStepLearnMetadata({ definition: endDefinition })

/**
 * Learn: end (termination) step.
 */
export default function LearnWorkflowStepEndPage() {
  return <WorkflowStepLearnDocPage definition={endDefinition} />
}
