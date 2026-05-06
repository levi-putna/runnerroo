import Docx, {
  Break,
  Cell,
  Hyperlink,
  Paragraph,
  Row,
  Table,
  Text,
  cm,
  type Length,
  type ParagraphChild,
} from "docxml"

/** Narrow OOXML cell children emitted by our XPath rules (paragraphs and nested tables). */
type DocXmlCellChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>

/** Narrow OOXML table-row children (table cells). */
type DocXmlRowChild = InstanceType<typeof Cell>

/** Narrow OOXML table-body children (rows). */
type DocXmlTableChild = InstanceType<typeof Row>

/** Text-run payloads acceptable inside {@link Text} when assembling XML fragments programmatically. */
type DocXmlInlinePieces = ConstructorParameters<typeof Text>[1] extends infer Q ? Q : never

/**
 * Flattens `traverse()` results into a uniform array for rest-spread into docxml constructors.
 */
function flattenParts(value: unknown): unknown[] {
  if (value == null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

/**
 * Counts columns on the first table row for naive fixed-width layout.
 */
function countTableColumns({ tableNode }: { tableNode: Node }): number {
  if (tableNode.nodeType !== 1) {
    return 1
  }
  const element = tableNode as Element
  const rows = element.getElementsByTagName("tr")
  if (rows.length === 0) {
    return 1
  }
  const firstRow = rows[0]
  let count = 0
  for (let i = 0; i < firstRow.children.length; i++) {
    const cell = firstRow.children.item(i)
    if (!cell) continue
    const name = cell.localName?.toLowerCase()
    if (name === "td" || name === "th") {
      count++
    }
  }
  return Math.max(count, 1)
}

/**
 * Builds equal column widths totalling roughly one A4 line width in centimetres.
 */
function columnWidthsForTable({ tableNode }: { tableNode: Node }): Length[] {
  const n = countTableColumns({ tableNode })
  const totalCm = 16
  const each = Math.max(totalCm / n, 2)
  return Array.from({ length: n }, () => cm(each))
}

/**
 * Renders arbitrary content XML into a docx byte payload using docxml translation rules.
 *
 * @see https://github.com/wvbe/docxml/wiki/Get-started
 */
export async function buildDocxUint8ArrayFromContentXml({
  xml,
}: {
  xml: string
}): Promise<Uint8Array> {
  const doc = Docx.fromNothing()
    .withXmlRule("self::document | self::body | self::root", ({ traverse }) => traverse("./*"))
    .withXmlRule("self::text()", ({ node }) => new Text({}, node.nodeValue ?? ""))
    .withXmlRule("self::p", ({ traverse }) => {
      const parts = flattenParts(traverse()) as ParagraphChild[]
      return new Paragraph({}, ...parts)
    })
    .withXmlRule("self::h1 | self::h2 | self::h3 | self::h4 | self::h5 | self::h6", ({ traverse }) => {
      const parts = flattenParts(traverse()) as ParagraphChild[]
      return new Paragraph({}, ...parts)
    })
    .withXmlRule("self::br", () => new Text({}, new Break({})))
    .withXmlRule("self::strong | self::b", ({ traverse }) => {
      const parts = flattenParts(traverse())
      return new Text({ isBold: true }, ...(parts as DocXmlInlinePieces[]))
    })
    .withXmlRule("self::em | self::i", ({ traverse }) => {
      const parts = flattenParts(traverse())
      return new Text({ isItalic: true }, ...(parts as DocXmlInlinePieces[]))
    })
    .withXmlRule("self::u", ({ traverse }) => {
      const parts = flattenParts(traverse())
      return new Text({ isUnderlined: "single" }, ...(parts as DocXmlInlinePieces[]))
    })
    .withXmlRule("self::s | self::strike | self::del", ({ traverse }) => {
      const parts = flattenParts(traverse())
      return new Text({ isStrike: true }, ...(parts as DocXmlInlinePieces[]))
    })
    .withXmlRule("self::a[@href]", ({ traverse, node }) => {
      const href = (node as Element).getAttribute("href") ?? ""
      const safeHref = href.trim().length > 0 ? href : "about:blank"
      const parts = flattenParts(traverse()) as InstanceType<typeof Text>[]
      const runs = parts.length > 0 ? parts : [new Text({}, "")]
      return new Hyperlink({ url: safeHref }, ...runs)
    })
    .withXmlRule("self::table", ({ node, traverse }) => {
      const widths = columnWidthsForTable({ tableNode: node })
      const rows = flattenParts(traverse("./tr")) as DocXmlTableChild[]
      return new Table({ columnWidths: widths }, ...rows)
    })
    .withXmlRule("self::tr", ({ traverse }) => {
      const cells = flattenParts(traverse("./td | ./th")) as DocXmlRowChild[]
      return new Row({}, ...cells)
    })
    .withXmlRule("self::td | self::th", ({ traverse }) => {
      const inner = flattenParts(traverse("./*")) as DocXmlCellChild[]
      return new Cell({}, ...inner)
    })

  doc.withXml(xml, {})

  const archive = await doc.toArchive()
  return archive.asUint8Array()
}
