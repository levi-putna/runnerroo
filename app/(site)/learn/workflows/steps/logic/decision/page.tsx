import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { decisionDefinition } from "@/lib/workflows/steps/logic/decision/definition"

export const metadata = workflowStepLearnMetadata({ definition: decisionDefinition })

/**
 * Learn: decision step.
 */
export default function LearnWorkflowStepDecisionPage() {
  return <WorkflowStepLearnDocPage definition={decisionDefinition} />
}
