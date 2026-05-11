import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Steps and behaviour | Learn | Dailify",
  description: "How workflow steps are organised, configured, and documented in Dailify.",
  openGraph: {
    title: "Steps and behaviour | Learn | Dailify",
    description: "How workflow steps are organised, configured, and documented in Dailify.",
  },
}

/**
 * Hub for workflow step documentation: cross-cutting topics and per-family guides.
 */
export default function LearnWorkflowStepsHubPage() {
  return (
    <LearnArticle
      title="Steps and behaviour"
      description="A consistent mental model for the canvas: what each family of steps does, where settings live, and how data flows through tags."
      titleLeading={<LearnWorkflowStepTitleIcon type="entry" entryType="invoke" />}
    >
      <p>
        Every step is a node on the graph. Triggers start a run; everything downstream receives the previous
        step&apos;s output automatically, so you wire behaviour with connections and with{" "}
        <strong>expression variables</strong> (tags like <ExpressionVariableTag id="input.*" />) instead of manual field mapping on each step.
      </p>

      <h2>Cross-cutting topics</h2>
      <p>Read these first: they apply to many step types.</p>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/expressions">Expression variables</Link>: what tags are, when they resolve,
          and the main namespaces (<code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">exe</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">global</code>, and others).
        </li>
        <li>
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link>: the{" "}
          <strong>Execution</strong> tab in the step sheet: which step types have one and what you configure there.
        </li>
      </ul>

      <h2>How these guides are structured</h2>
      <p>Each step family page follows the same outline so you can skim predictably:</p>
      <ol>
        <li>
          <strong>Overview</strong>: what the family is for on the canvas.
        </li>
        <li>
          <strong>Steps in this family</strong>: short descriptions and how they differ.
        </li>
        <li>
          <strong>Configuration</strong>: where settings live in the editor (General, Execution, Output, Gate, and so
          on).
        </li>
        <li>
          <strong>Data flow</strong>: how inbound data and tags behave for this group.
        </li>
        <li>
          <strong>Related</strong>: links back to expression variables, execution settings, or deep dives (for example{" "}
          <Link href="/learn/workflows/steps/code">Code</Link>).
        </li>
      </ol>

      <h2>Step family guides</h2>
      <p>Each family has an overview plus a short article for every catalogue template.</p>

      <h3>Triggers</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/triggers">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/triggers/invoke">Invoke</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/triggers/webhook">Webhook</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/triggers/schedule">Schedule</Link>
        </li>
      </ul>

      <h3>Logic</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/logic">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/logic/decision">Decision</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/logic/switch">Switch</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/logic/split">Split</Link>
        </li>
      </ul>

      <h3>Human</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/human">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/human/approval">Approval</Link>
        </li>
      </ul>

      <h3>AI</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/ai">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/ai/generate">Generate text</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/ai/summarize">Summarise content</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/ai/classify">Classify input</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/ai/extract">Extract data</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/ai/chat">Chat completion</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/ai/transform">Transform data</Link>
        </li>
      </ul>

      <h3>Code</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/code">Run code</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/code/random">Random number</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/code/iteration">Iteration</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/computation">Code helpers</Link> (random and iteration in more detail)
        </li>
      </ul>

      <h3>Documents</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/documents">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/documents/template">Document from Template</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/documents/docxml">Generate document (XML)</Link>
        </li>
      </ul>

      <h3>Actions</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/actions">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/actions/built-in">Action</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/actions/webhook-call">Webhook</Link>
        </li>
      </ul>

      <h3>Termination</h3>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/termination">Overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/termination/end">End</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
