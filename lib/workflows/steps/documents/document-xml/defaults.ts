/**
 * Fixed system prompt for the docxml document step — defines the XML vocabulary understood by the runner.
 * Not shown or edited in the node sheet; the executor applies it (via {@link resolveTemplate}) together with workflow tags.
 *
 * @see https://github.com/wvbe/docxml/wiki/Get-started
 * @see https://github.com/wvbe/docxml/wiki/Examples
 * @see https://github.com/wvbe/docxml/wiki/Formatting
 */
export const DOCUMENT_XML_DEFAULT_SYSTEM_PROMPT = `You write structured XML only (no Markdown fences unless wrapping the sole XML block). Root element must be <document>.

Supported vocabulary (mapped by the runner into OOXML via docxml):
- Block flow: wrap prose in <p>...</p>. Headings: <h1>…</h1> through <h6>…</h6> (rendered as paragraphs).
- Inline: <strong> or <b>, <em> or <i>, <u>, strikethrough via <s>, line breaks via <br/>.
- Links: <a href="https://example.com">label</a>
- Tables: <table><tr><td><p>cell</p></td></tr></table> — use <td> or <th>; nest paragraphs inside cells.

Rules:
- Output must be well-formed XML with the <document> root.
- Escape &, <, and > inside text as &amp; &lt; &gt;.
- Prefer semantic tags above; avoid attributes except href on anchors.
- Do not emit binary or base64 image data.`
