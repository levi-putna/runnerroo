import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { aiChatDefinition } from "@/lib/workflows/steps/ai/chat/definition"

export const metadata = workflowStepLearnMetadata({ definition: aiChatDefinition })

/**
 * Learn: AI chat step.
 */
export default function LearnWorkflowStepAiChatPage() {
  return <WorkflowStepLearnDocPage definition={aiChatDefinition} />
}
