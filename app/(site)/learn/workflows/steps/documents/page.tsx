import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Document workflow steps | Learn | Dailify",
  description: "Template-based and DocXML document generation steps on the workflow canvas.",
  openGraph: {
    title: "Document workflow steps | Learn | Dailify",
    description: "Template-based and DocXML document generation steps on the workflow canvas.",
  },
}

/**
 * Learn: document generation workflow steps.
 */
export default function LearnWorkflowDocumentsPage() {
  return (
    <LearnArticle
      title="Documents"
      description="Produce files from reusable templates or from DocXML instructions. Both variants share the document node type; the subtype selects the pipeline."
      titleLeading={<LearnWorkflowStepTitleIcon type="document" documentSubtype="template" />}
    >
      <h2>Overview</h2>
      <p>
        Document steps turn structured workflow data into downloadable artefacts (for example Word documents). They
        combine model or author instructions with placeholders bound to expression variables.
      </p>

      <h2>Steps in this family</h2>
      <h3>From template</h3>
      <p>
        Start from a managed template: map invoke and upstream keys into template placeholders, then generate a file
        with consistent branding and layout.
      </p>
      <h3>DocXML</h3>
      <p>
        Drive generation from DocXML instructions when you need finer control over structure than a static template
        alone provides.
      </p>

      <h2>Configuration</h2>
      <p>
        <Link href="/learn/workflows/steps/execution-settings">Execution tab</Link>: model instructions, template
        selection, and binding surfaces appropriate to the subtype.
      </p>
      <p>
        <strong>Output</strong> tab: expose download URLs, filenames, or derived metadata for later steps (email
        attachments, CRM uploads, and so on).
      </p>

      <h2>Data flow</h2>
      <p>
        Tags in instructions resolve like other AI-adjacent fields: inbound <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">trigger_inputs</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">global</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">const</code>, and <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">now</code>{" "}
        helpers. See <Link href="/learn/workflows/steps/expressions">Expression variables</Link>.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/ai">AI</Link>: when you only need text instead of a file artefact.
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
