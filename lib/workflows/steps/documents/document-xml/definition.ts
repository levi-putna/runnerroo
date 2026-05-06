import {
  WORKFLOW_DOCUMENT_FAMILY_META,
  WORKFLOW_DOCUMENT_SUBTYPE_META,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"
import { buildDefaultGenerateDocumentOutputSchemaFields } from "@/lib/workflows/engine/input-schema"
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models"

const family = WORKFLOW_DOCUMENT_FAMILY_META
const row = WORKFLOW_DOCUMENT_SUBTYPE_META.docxml

/**
 * Catalogue definition for generating a .docx from model-produced XML via docxml.
 */
export const documentFromXmlDefinition: StepDefinition = {
  type: "document",
  subtype: "docxml",
  group: "documents",
  label: "Generate document (XML)",
  description:
    "Use an AI model to emit structured XML, then render it to a .docx with docxml (see project wiki for supported tags)",
  defaultData: {
    label: "Generate document (XML)",
    description: "Model writes XML; runner converts to Word (.docx) and uploads the file",
    subtype: "docxml",
    model: DEFAULT_MODEL_ID,
    prompt: "",
    outputFileName: "generated-document.docx",
    inputSchema: [],
    outputSchema: buildDefaultGenerateDocumentOutputSchemaFields(),
    globalsSchema: [],
  },
  Icon: row.Icon,
  accentBg: family.accentBg,
  accentHex: family.accentHex,
}
