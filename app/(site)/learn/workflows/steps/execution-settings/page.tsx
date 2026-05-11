import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Execution settings | Learn | Dailify",
  description:
    "The Execution tab in the workflow step sheet: which steps expose it and what you configure there.",
  openGraph: {
    title: "Execution settings | Learn | Dailify",
    description:
      "The Execution tab in the workflow step sheet: which steps expose it and what you configure there.",
  },
}

/**
 * Learn: workflow step Execution tab (runtime behaviour distinct from output mapping).
 */
export default function LearnWorkflowExecutionSettingsPage() {
  return (
    <LearnArticle
      title="Execution settings"
      description="The Execution tab holds the settings that run the step itself (models, prompts, code, documents, HTTP calls, and numeric expressions), separate from the Output tab where you shape what the next step receives."
      titleLeading={<LearnWorkflowStepTitleIcon type="ai" aiSubtype="generate" />}
    >
      <h2>Which steps have an Execution tab?</h2>
      <p>Only steps that perform work needing a dedicated runtime panel:</p>
      <ul>
        <li>
          <strong>AI</strong>: model choice, instructions (or subtype-specific bodies such as content to summarise or
          transform), and fields that feed the model pipeline.
        </li>
        <li>
          <strong>Run code</strong>: timeout, result type coercion, and the JavaScript source (tags resolved before the
          sandbox runs). See the <Link href="/learn/workflows/steps/code">Code</Link> guide.
        </li>
        <li>
          <strong>Random number</strong>: bounds and expressions for the sampled range, driven by tags where needed.
        </li>
        <li>
          <strong>Iteration</strong>: how the counter increments (expressions and inbound data).
        </li>
        <li>
          <strong>Document</strong>: template or DocXML execution: model instructions, template bindings, and related
          options for generating files.
        </li>
        <li>
          <strong>Webhook call</strong>: method, URL, headers, and body templates resolved against the same tag
          context as other steps.
        </li>
      </ul>
      <p>
        Triggers use the <strong>Input</strong> tab instead (invoke schema, schedule, or webhook configuration). Logic
        steps (decision, switch, split) use <strong>Gate</strong> or <strong>Branch</strong> tabs. Human and termination
        nodes expose <strong>Output</strong> (and General) rather than Execution in the same sense.
      </p>

      <h2>Execution versus Output</h2>
      <p>
        <strong>Execution</strong> answers &quot;what runs right now?&quot; Call the model with these instructions,
        run this script inside the timeout, POST this JSON payload.
      </p>
      <p>
        <strong>Output</strong> answers &quot;what object do downstream steps see as <ExpressionVariableTag id="input.*" />?&quot; Map keys from{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">exe</code> and literals into a clean JSON
        shape, declare globals, or define branch handles.
      </p>

      <h2>Tags in execution fields</h2>
      <p>
        Execution fields resolve with the base tag context:{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">trigger_inputs</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">global</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">const</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">now</code>, and metadata namespaces. See{" "}
        <Link href="/learn/workflows/steps/expressions">Expression variables</Link> for detail.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/expressions">Expression variables</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
