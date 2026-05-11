import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Human | Learn | Dailify",
  description: "Pause a workflow for human approval or decline, then resume with structured outputs.",
  openGraph: {
    title: "Human | Learn | Dailify",
    description: "Pause a workflow for human approval or decline, then resume with structured outputs.",
  },
}

/**
 * Learn: human-in-the-loop approval workflow step.
 */
export default function LearnWorkflowHumanPage() {
  return (
    <LearnArticle
      title="Human"
      description="Pause execution until someone approves or declines from the inbox. Downstream logic can branch on the decision using mapped output keys."
      titleLeading={<LearnWorkflowStepTitleIcon type="approval" />}
    >
      <h2>Overview</h2>
      <p>
        The approval step is how you insert <strong>human judgement</strong> into an automated graph: policy sign-off,
        risky transfers, publication gates, or any checkpoint that must not run purely on model output.
      </p>

      <h2>Steps in this family</h2>
      <p>
        Today the human family centres on a single <strong>Approval</strong> template: configure copy, timeouts if
        applicable, and outputs that carry the reviewer&apos;s decision into the next nodes.
      </p>

      <h2>Configuration</h2>
      <p>
        Use <strong>General</strong> for labels and user-facing messaging where the product exposes it, and{" "}
        <strong>Output</strong> to map decision metadata (for example decision enum, timestamps) from <ExpressionVariableTag id="exe.*" /> after a response. There is
        no Execution tab: the work happens in the inbox UI instead of inside a model or sandbox.
      </p>

      <h2>Data flow</h2>
      <p>
        While waiting, the run sits in a paused state; after action, the runner emits the mapped output object like any
        other step so branches and AI steps can continue.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/assistant/tools">Assistant tools and approvals</Link>: product-level context for
          approvals where documented.
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
