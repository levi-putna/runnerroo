import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { aiClassifyDefinition } from "@/lib/workflows/steps/ai/classify/definition"

export const metadata = workflowStepLearnMetadata({ definition: aiClassifyDefinition })

/**
 * Learn: AI classify step.
 */
export default function LearnWorkflowStepAiClassifyPage() {
  return <WorkflowStepLearnDocPage definition={aiClassifyDefinition} />
}
