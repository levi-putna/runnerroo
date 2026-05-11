import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "AI | Learn | Dailify",
  description:
    "Generate, summarise, classify, extract, chat, and transform steps: model choice, instructions, and outputs.",
  openGraph: {
    title: "AI | Learn | Dailify",
    description:
      "Generate, summarise, classify, extract, chat, and transform steps: model choice, instructions, and outputs.",
  },
}

/**
 * Learn: AI family workflow steps (single canvas type, subtype selects template).
 */
export default function LearnWorkflowAiStepsPage() {
  return (
    <LearnArticle
      title="AI"
      description="All AI templates share one node type on the canvas; the subtype picks the executor (generate text, summarise, classify, extract, chat, or transform). Each subtype has its own Execution fields and Output shape."
      titleLeading={<LearnWorkflowStepTitleIcon type="ai" aiSubtype="generate" />}
    >
      <h2>Overview</h2>
      <p>
        AI templates call a language model through the product&apos;s AI gateway. You choose a <strong>model</strong>, craft{" "}
        <strong>instructions</strong> (or subtype-specific bodies), and map structured outputs on the{" "}
        <strong>Output</strong> tab so downstream steps receive stable JSON keys.
      </p>

      <h2>Steps in this family</h2>
      <ul>
        <li>
          <strong>Generate text</strong>: open-ended generation from instructions plus optional tool-style behaviour
          configured in the sheet.
        </li>
        <li>
          <strong>Summarise</strong>: condense supplied content; optional guidance steers format without overriding the
          core task.
        </li>
        <li>
          <strong>Classify</strong>: choose exactly one label from a catalogue you define; confidence and reasoning
          fields map to <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">exe</code> outputs.
        </li>
        <li>
          <strong>Extract</strong>: fill a typed field list from source content; enforced schema drives the model
          contract.
        </li>
        <li>
          <strong>Chat</strong>: multi-turn style messaging with the model using thread context configured on the node.
        </li>
        <li>
          <strong>Transform</strong>: rewrite or restructure prior content according to instructions and an optional
          dedicated content expression.
        </li>
      </ul>

      <h2>Configuration</h2>
      <p>
        <Link href="/learn/workflows/steps/execution-settings">Execution tab</Link>: model selector, instructions or
        optional guidance (depending on subtype), and any per-template bodies (for example content to summarise).
      </p>
      <p>
        <strong>Output</strong> tab: declare outbound keys and map from <ExpressionVariableTag id="exe.*" />{" "}
        fields after a test run or use import helpers where available.
      </p>

      <h2>Data flow</h2>
      <p>
        Instructions and content fields resolve expression variables from the inbound step, globals, constants, and
        time helpers. See <Link href="/learn/workflows/steps/expressions">Expression variables</Link>. Output mappings
        run after the model returns, in an extended context that includes <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">exe</code>.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/code">Code</Link> when deterministic code fits better than a model.
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
