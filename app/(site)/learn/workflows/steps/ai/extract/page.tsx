import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { aiExtractDefinition } from "@/lib/workflows/steps/ai/extract/definition"

export const metadata = workflowStepLearnMetadata({ definition: aiExtractDefinition })

/**
 * Learn: AI extract step.
 */
export default function LearnWorkflowStepAiExtractPage() {
  return <WorkflowStepLearnDocPage definition={aiExtractDefinition} />
}
