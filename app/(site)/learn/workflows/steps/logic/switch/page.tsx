import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { switchDefinition } from "@/lib/workflows/steps/logic/switch/definition"

export const metadata = workflowStepLearnMetadata({ definition: switchDefinition })

/**
 * Learn: switch step.
 */
export default function LearnWorkflowStepSwitchPage() {
  return <WorkflowStepLearnDocPage definition={switchDefinition} />
}
