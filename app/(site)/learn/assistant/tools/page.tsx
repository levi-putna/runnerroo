import type { Metadata } from "next"

import { LearnArticle } from "@/components/site/learn-article"

export const metadata: Metadata = {
  title: "Tools and approvals | Learn | Dailify",
  description: "Tool calls, human approvals, and safe automation.",
  openGraph: {
    title: "Tools and approvals | Learn | Dailify",
    description: "Tool calls, human approvals, and safe automation.",
  },
}

/**
 * Assistant tools and approvals: safety and governance.
 */
export default function LearnAssistantToolsPage() {
  return (
    <LearnArticle
      title="Tools and approvals"
      description="Let the assistant act with guardrails when a human must confirm."
    >
      <p>
        Tools can fetch data, update systems, or kick off workflows. When a tool is sensitive, route it through an
        approval step so the right owner can accept or reject before side effects land.
      </p>
      <h2>Inbox</h2>
      <p>
        Pending approvals surface in your inbox so nothing stalls silently. Clear the queue to keep automation moving.
      </p>
    </LearnArticle>
  )
}
