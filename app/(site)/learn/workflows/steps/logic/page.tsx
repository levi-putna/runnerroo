import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Logic | Learn | Dailify",
  description: "Decision, switch, and split steps for conditional and parallel workflow routing.",
  openGraph: {
    title: "Logic | Learn | Dailify",
    description: "Decision, switch, and split steps for conditional and parallel workflow routing.",
  },
}

/**
 * Learn: workflow logic steps (decision, switch, split).
 */
export default function LearnWorkflowLogicPage() {
  return (
    <LearnArticle
      title="Logic"
      description="Route runs with boolean gates, multi-case switches, or parallel fan-out. Each pattern exposes different handles on the canvas."
      titleLeading={<LearnWorkflowStepTitleIcon type="decision" />}
    >
      <h2>Overview</h2>
      <p>
        Logic steps sit between data-producing steps. They read the same{" "}
        <ExpressionVariableTag id="input.*" /> object as other
        non-trigger nodes, then choose one or many outbound paths.
      </p>

      <h2>Steps in this family</h2>
      <h3>Decision</h3>
      <p>
        Classic if / else: evaluate gate groups against the inbound payload and globals. Exactly one branch wins; wire
        the true and false handles to different subgraphs.
      </p>
      <h3>Switch</h3>
      <p>
        Multi-way routing: ordered cases with conditions. Useful when you have several discrete outcomes instead of a
        single boolean split.
      </p>
      <h3>Split</h3>
      <p>
        Parallel fan-out: every connected branch receives the same inbound payload. Downstream merges are not implied;
        design joins explicitly if your process needs a single thread again.
      </p>

      <h2>Configuration</h2>
      <p>
        <strong>Gate</strong> tab: build conditions for decision and switch (expressions and comparisons over{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">global</code>, constants, and trigger data).
      </p>
      <p>
        <strong>Branch</strong> tab: only on split: name parallel paths; each path exposes its own canvas handle.
      </p>
      <p>
        <strong>Output</strong> tab: map what downstream nodes see per branch, including any passthrough fields you
        want to preserve.
      </p>

      <h2>Data flow</h2>
      <p>
        Gate <em>value</em> cells may contain expression variables; see{" "}
        <Link href="/learn/workflows/steps/expressions">Expression variables</Link> and note how trigger constants and
        globals participate in comparisons.
      </p>

      <h2>Related</h2>
      <ul>
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
