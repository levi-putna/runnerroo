import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Workflow action steps | Learn | Dailify",
  description: "Built-in actions and outbound webhook calls for Dailify workflows.",
  openGraph: {
    title: "Workflow action steps | Learn | Dailify",
    description: "Built-in actions and outbound webhook calls for Dailify workflows.",
  },
}

/**
 * Learn: workflow action steps (generic action and webhook call).
 */
export default function LearnWorkflowActionsPage() {
  return (
    <LearnArticle
      title="Actions"
      description="Integrate with product built-ins or call arbitrary HTTP endpoints. Webhook steps expose method, URL, headers, and body templates on the Execution tab."
      titleLeading={<LearnWorkflowStepTitleIcon type="action" />}
    >
      <h2>Overview</h2>
      <p>
        Action steps cover <strong>first-party operations</strong> (the generic action template) and{" "}
        <strong>outbound HTTP</strong> via the webhook-call template. They are ideal for side effects after data has
        been validated by earlier nodes.
      </p>

      <h2>Steps in this family</h2>
      <h3>Action</h3>
      <p>
        Uses the product&apos;s built-in action catalogue: pick the integration behaviour your workspace exposes, then
        map inputs from upstream tags.
      </p>
      <h3>Webhook call</h3>
      <p>
        Performs an HTTP request with templated URL, headers, and body. Downstream steps read status codes and
        response snippets through <ExpressionVariableTag id="exe.*" />{" "}
        mappings on the Output tab.
      </p>

      <h2>Configuration</h2>
      <p>
        Webhook call uses the <Link href="/learn/workflows/steps/execution-settings">Execution tab</Link> for transport
        details; both templates use <strong>Output</strong> to shape passthrough or response-derived fields.
      </p>

      <h2>Data flow</h2>
      <p>
        Templates resolve with the same expression variable rules as AI and code: see{" "}
        <Link href="/learn/workflows/steps/expressions">Expression variables</Link>. Avoid logging secrets into outputs
        mapped for later AI prompts.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/triggers">Triggers</Link>: inbound webhooks differ from outbound webhook
          calls.
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
