import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { splitDefinition } from "@/lib/workflows/steps/logic/split/definition"

export const metadata = workflowStepLearnMetadata({ definition: splitDefinition })

/**
 * Learn: split step.
 */
export default function LearnWorkflowStepSplitPage() {
  return <WorkflowStepLearnDocPage definition={splitDefinition} />
}
