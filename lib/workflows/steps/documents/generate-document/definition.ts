import { WORKFLOW_NODE_CORE_META } from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

const meta = WORKFLOW_NODE_CORE_META.document

/**
 * Catalogue definition for generating a .docx document from a stored template.
 */
export const generateDocumentDefinition: StepDefinition = {
  type: "document",
  group: "documents",
  label: "Generate document",
  description: "Create a document from a template and resolved schema values",
  defaultData: {
    label: "Generate document",
    description: "Fill a template with values and upload the generated document",
    outputFileName: "generated-document.docx",
    templateFileId: "",
    templateFileName: "",
    documentSchema: [],
  },
  Icon: meta.Icon,
  accentBg: meta.accentBg,
  accentHex: meta.accentHex,
}
