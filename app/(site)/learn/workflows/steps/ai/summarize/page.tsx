import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { aiSummarizeDefinition } from "@/lib/workflows/steps/ai/summarize/definition"

export const metadata = workflowStepLearnMetadata({ definition: aiSummarizeDefinition })

/**
 * Learn: AI summarise step.
 */
export default function LearnWorkflowStepAiSummarizePage() {
  return <WorkflowStepLearnDocPage definition={aiSummarizeDefinition} />
}
