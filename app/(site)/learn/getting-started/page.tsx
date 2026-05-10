import type { Metadata } from "next"

import { LearnArticle } from "@/components/site/learn-article"

export const metadata: Metadata = {
  title: "Getting started | Learn | Dailify",
  description: "Create an account, open the app, and ship your first workflow.",
  openGraph: {
    title: "Getting started | Learn | Dailify",
    description: "Create an account, open the app, and ship your first workflow.",
  },
}

/**
 * Getting started guide: account, navigation, first workflow.
 */
export default function LearnGettingStartedPage() {
  return (
    <LearnArticle
      title="Getting started"
      description="Create an account, explore the app, and publish your first workflow."
    >
      <h2>1. Create your account</h2>
      <p>
        Use <strong>Join</strong> on the marketing site or navigate to <code>/signup</code>. You will sign in with email
        and a one-time code.
      </p>
      <h2>2. Open the app</h2>
      <p>
        After sign-in you land in <strong>Workflows</strong>. From there you can open the assistant, runs, settings, and
        more from the sidebar.
      </p>
      <h2>3. Build a workflow</h2>
      <p>
        Create a new workflow, add nodes on the canvas, and connect them. Save often: your graph is the source of truth
        for how work moves through your team.
      </p>
    </LearnArticle>
  )
}
