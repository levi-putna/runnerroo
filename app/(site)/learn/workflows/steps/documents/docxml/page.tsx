import { WorkflowStepLearnDocPage } from "@/components/site/workflow-step-learn-doc"
import { workflowStepLearnMetadata } from "@/lib/learn/workflow-step-learn-metadata"
import { documentFromXmlDefinition } from "@/lib/workflows/steps/documents/document-xml/definition"

export const metadata = workflowStepLearnMetadata({ definition: documentFromXmlDefinition })

/**
 * Learn: document from DocXML step.
 */
export default function LearnWorkflowStepDocumentDocxmlPage() {
  return <WorkflowStepLearnDocPage definition={documentFromXmlDefinition} />
}
