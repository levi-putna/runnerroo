import type { Metadata } from "next"

import { LearnArticle } from "@/components/site/learn-article"

export const metadata: Metadata = {
  title: "Runs and schedules | Learn | Dailify",
  description: "Execute workflows on demand or on a schedule.",
  openGraph: {
    title: "Runs and schedules | Learn | Dailify",
    description: "Execute workflows on demand or on a schedule.",
  },
}

/**
 * Runs and schedules: operational view of workflows.
 */
export default function LearnWorkflowsRunsPage() {
  return (
    <LearnArticle
      title="Runs and schedules"
      description="Trigger executions manually, from the assistant, or on a recurring cadence."
    >
      <p>
        Each run captures inputs, step output, and timing. Use run history to debug failures and to prove what ran in
        production.
      </p>
      <h2>Schedules</h2>
      <p>
        When a workflow should wake up on its own, attach a schedule in workflow settings. Cron-friendly expressions
        help you align with business hours across regions.
      </p>
    </LearnArticle>
  )
}
