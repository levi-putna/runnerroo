import type { Metadata } from "next"

import { LearnArticle } from "@/components/site/learn-article"

export const metadata: Metadata = {
  title: "Chat and context — Learn — Dailify",
  description: "How the assistant uses conversation and sidebar context.",
  openGraph: {
    title: "Chat and context — Learn — Dailify",
    description: "How the assistant uses conversation and sidebar context.",
  },
}

/**
 * Assistant context — conversation and sidebar usage.
 */
export default function LearnAssistantContextPage() {
  return (
    <LearnArticle
      title="Chat and context"
      description="Ground the assistant with the right thread, model, and sidebar panels."
    >
      <p>
        Each chat thread keeps its own history. Open the context panel to inspect memories, usage, and attachments that
        travel with the session.
      </p>
      <h2>Model selection</h2>
      <p>
        Pick a model that matches cost and capability. Gateway-backed models make it easy to switch providers without
        rewriting your UI.
      </p>
    </LearnArticle>
  )
}
