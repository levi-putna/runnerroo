import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Termination | Learn | Dailify",
  description: "Terminate a workflow branch and map final outputs or response payloads.",
  openGraph: {
    title: "Termination | Learn | Dailify",
    description: "Terminate a workflow branch and map final outputs or response payloads.",
  },
}

/**
 * Learn: workflow termination (End template) step family.
 */
export default function LearnWorkflowTerminationPage() {
  return (
    <LearnArticle
      title="Termination"
      description="Marks a successful stop for a branch. Use the Output tab when you need a final payload shape for invoke responses or downstream consumers."
      titleLeading={<LearnWorkflowStepTitleIcon type="end" />}
    >
      <h2>Overview</h2>
      <p>
        The <strong>End</strong> node tells the runner this branch completed intentionally. Multiple end nodes may
        exist on a graph when different branches finish separately.
      </p>

      <h2>Steps in this family</h2>
      <p>
        There is a single termination template today: focus on mapping the fields you want callers or logs to
        retain.
      </p>

      <h2>Configuration</h2>
      <p>
        <strong>General</strong> for naming, and <strong>Output</strong> to define the final object (often pulling
        from <ExpressionVariableTag id="input.*" />, trigger data, or
        globals). There is no Execution tab.
      </p>

      <h2>Data flow</h2>
      <p>
        Whatever you map becomes the emitted output for that branch&apos;s completion: align keys with whatever your
        integration expects when a run finishes.
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
