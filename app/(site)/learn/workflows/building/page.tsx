import type { Metadata } from "next"

import { LearnArticle } from "@/components/site/learn-article"

export const metadata: Metadata = {
  title: "Building a flow — Learn — Dailify",
  description: "Nodes, edges, and layout tips for the workflow canvas.",
  openGraph: {
    title: "Building a flow — Learn — Dailify",
    description: "Nodes, edges, and layout tips for the workflow canvas.",
  },
}

/**
 * Building a workflow graph — canvas-oriented guidance.
 */
export default function LearnWorkflowsBuildingPage() {
  return (
    <LearnArticle
      title="Building a flow"
      description="Use the canvas to model real hand-offs — not just diagrams."
    >
      <p>
        Drag nodes onto the canvas and connect handles to express order and dependencies. Name nodes clearly so future
        you (and teammates) can read the graph at a glance.
      </p>
      <h2>Layout tips</h2>
      <p>
        Keep the main path left-to-right or top-to-bottom. Group optional branches beneath the primary spine so reviewers
        can scan outcomes quickly.
      </p>
    </LearnArticle>
  )
}
