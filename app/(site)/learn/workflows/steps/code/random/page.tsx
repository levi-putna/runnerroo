import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { randomNumberDefinition } from "@/lib/workflows/steps/code/random/definition"

export const metadata = workflowStepLearnMetadata({ definition: randomNumberDefinition })

/**
 * Learn: random number step.
 */
export default function LearnWorkflowStepRandomNumberPage() {
  return <WorkflowStepLearnDocPage definition={randomNumberDefinition} />
}
