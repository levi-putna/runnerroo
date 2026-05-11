import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { aiGenerateDefinition } from "@/lib/workflows/steps/ai/generate/definition"

export const metadata = workflowStepLearnMetadata({ definition: aiGenerateDefinition })

/**
 * Learn: AI generate text step.
 */
export default function LearnWorkflowStepAiGeneratePage() {
  return <WorkflowStepLearnDocPage definition={aiGenerateDefinition} />
}
