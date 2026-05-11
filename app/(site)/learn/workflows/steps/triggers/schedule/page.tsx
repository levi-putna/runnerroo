import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { scheduleTriggerDefinition } from "@/lib/workflows/steps/triggers/schedule/definition"

export const metadata = workflowStepLearnMetadata({ definition: scheduleTriggerDefinition })

/**
 * Learn: schedule trigger step.
 */
export default function LearnWorkflowStepScheduleTriggerPage() {
  return <WorkflowStepLearnDocPage definition={scheduleTriggerDefinition} />
}
