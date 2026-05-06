import {
  WORKFLOW_DOCUMENT_FAMILY_META,
  WORKFLOW_DOCUMENT_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"
import { buildDefaultGenerateDocumentOutputSchemaFields } from "@/lib/workflows/engine/input-schema"

const family = WORKFLOW_DOCUMENT_FAMILY_META
const row = WORKFLOW_DOCUMENT_SUBTYPE_META.template

/**
 * Catalogue definition for filling a stored .docx template and uploading the output.
 */
export const documentFromTemplateDefinition: StepDefinition = {
  type: "document",
  subtype: "template",
  group: "documents",
  label: "Document from Template",
  description:
    "Create a filled document from a stored template using resolved schema values (Docxtemplater)",
  defaultData: {
    label: "Document from Template",
    description: "Fill a document template with values and upload the generated file",
    subtype: "template",
    outputFileName: "generated-document.docx",
    templateFileId: "",
    templateFileName: "",
    documentSchema: [],
    outputSchema: buildDefaultGenerateDocumentOutputSchemaFields(),
    globalsSchema: [],
  },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
