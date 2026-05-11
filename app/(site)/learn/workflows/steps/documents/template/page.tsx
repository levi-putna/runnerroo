import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { documentFromTemplateDefinition } from "@/lib/workflows/steps/documents/document-from-template/definition"

export const metadata = workflowStepLearnMetadata({ definition: documentFromTemplateDefinition })

/**
 * Learn: document from template step.
 */
export default function LearnWorkflowStepDocumentTemplatePage() {
  return <WorkflowStepLearnDocPage definition={documentFromTemplateDefinition} />
}
