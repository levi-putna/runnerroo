import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Code helpers | Learn | Dailify",
  description: "Random number and iteration counter steps for lightweight numeric workflow logic.",
  openGraph: {
    title: "Code helpers | Learn | Dailify",
    description: "Random number and iteration counter steps for lightweight numeric workflow logic.",
  },
}

/**
 * Learn: Code helper steps (random number and iteration).
 */
export default function LearnWorkflowComputationPage() {
  return (
    <LearnArticle
      title="Code helpers"
      description="Small deterministic steps for sampling a random number or bumping a counter. They are faster to configure than Run code when the built-in maths already matches your need."
      titleLeading={<LearnWorkflowStepTitleIcon type="random" />}
    >
      <h2>Overview</h2>
      <p>
        These nodes live in the <strong>Code</strong> group in the add-step sheet but are <em>not</em> the full
        JavaScript sandbox: they execute narrow, optimised paths with typed outputs.
      </p>

      <h2>Steps in this family</h2>
      <h3>Random number</h3>
      <p>
        Draws a value inside configurable bounds. Bounds may be literals or expression variables so upstream steps can
        widen or narrow the range per run.
      </p>
      <h3>Iteration</h3>
      <p>
        Increments a counter for loops or pacing patterns. Combine with logic steps when you need to stop after N
        traversals (design the graph so the counter feeds a decision or switch).
      </p>

      <h2>Configuration</h2>
      <p>
        Both use the <Link href="/learn/workflows/steps/execution-settings">Execution tab</Link> for the numeric
        parameters and the <strong>Output</strong> tab to publish fields such as the sampled number or the new counter
        value for downstream <ExpressionVariableTag id="input.*" />.
      </p>

      <h2>Data flow</h2>
      <p>
        Treat outputs like any other step: the next node receives the mapped JSON object. When you need arbitrary
        control flow, switch to <Link href="/learn/workflows/steps/code">Code</Link> instead.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/code">Code</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/expressions">Expression variables</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
