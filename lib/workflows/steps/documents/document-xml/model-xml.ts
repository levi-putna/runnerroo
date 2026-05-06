/**
 * Helpers for normalising model output into the XML fragment consumed by docxml.
 */

/**
 * Pulls the primary XML payload from a language-model reply (Markdown ```xml fences optional).
 */
export function extractContentXmlFromModelText({ text }: { text: string }): string {
  const trimmed = text.trim()
  const fenced = /^```(?:xml)?\s*([\s\S]*?)```/im.exec(trimmed)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }
  const docBlock = /<document\b[\s\S]*<\/document>/im.exec(trimmed)
  if (docBlock?.[0]) {
    return docBlock[0].trim()
  }
  return trimmed
}

/**
 * Ensures a single `<document>` root so XPath rules registered on the runner can match consistently.
 */
export function ensureDocumentRootXml({ xml }: { xml: string }): string {
  const t = xml.trim()
  if (/^<document\b/i.test(t)) {
    return t
  }
  return `<document>${t}</document>`
}
