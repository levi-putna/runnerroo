import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { invokeTriggerDefinition } from "@/lib/workflows/steps/triggers/invoke/definition"

export const metadata = workflowStepLearnMetadata({ definition: invokeTriggerDefinition })

/**
 * Learn: invoke trigger step.
 */
export default function LearnWorkflowStepInvokePage() {
  return <WorkflowStepLearnDocPage definition={invokeTriggerDefinition} />
}
