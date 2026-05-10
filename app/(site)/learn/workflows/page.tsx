import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { LearnWorkflowsHero } from "@/components/site/learn-workflows-hero"

export const metadata: Metadata = {
  title: "Workflows — Learn — Dailify",
  description: "Concepts for building and operating visual workflows.",
  openGraph: {
    title: "Workflows — Learn — Dailify",
    description: "Concepts for building and operating visual workflows.",
  },
}

/**
 * Workflows overview in the Learn section.
 */
export default function LearnWorkflowsPage() {
  return (
    <LearnArticle
      title="Workflows"
      description="Design durable automations on a canvas you can share, review, and iterate."
      hero={<LearnWorkflowsHero />}
    >
      <p>
        Workflows combine steps, branching, and integrations. You can schedule runs, inspect history, and wire human
        approvals when a step needs sign-off.
      </p>
      <h2>Topics</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/building">Building a flow</Link>
        </li>
        <li>
          <Link href="/learn/workflows/runs">Runs and schedules</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
