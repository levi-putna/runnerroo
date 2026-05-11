import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { webhookTriggerDefinition } from "@/lib/workflows/steps/triggers/webhook/definition"

export const metadata = workflowStepLearnMetadata({ definition: webhookTriggerDefinition })

/**
 * Learn: webhook trigger step.
 */
export default function LearnWorkflowStepWebhookTriggerPage() {
  return <WorkflowStepLearnDocPage definition={webhookTriggerDefinition} />
}
