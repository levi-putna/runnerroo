import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { aiTransformDefinition } from "@/lib/workflows/steps/ai/transform/definition"

export const metadata = workflowStepLearnMetadata({ definition: aiTransformDefinition })

/**
 * Learn: AI transform step.
 */
export default function LearnWorkflowStepAiTransformPage() {
  return <WorkflowStepLearnDocPage definition={aiTransformDefinition} />
}
