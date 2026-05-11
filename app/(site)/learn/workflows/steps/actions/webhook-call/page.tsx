import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { webhookCallDefinition } from "@/lib/workflows/steps/actions/webhook-call/definition"

export const metadata = workflowStepLearnMetadata({ definition: webhookCallDefinition })

/**
 * Learn: outbound webhook call step.
 */
export default function LearnWorkflowStepWebhookCallPage() {
  return <WorkflowStepLearnDocPage definition={webhookCallDefinition} />
}
