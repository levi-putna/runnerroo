import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"

export const metadata: Metadata = {
  title: "Assistant | Learn | Dailify",
  description: "Chat with context, tools, and your workspace.",
  openGraph: {
    title: "Assistant | Learn | Dailify",
    description: "Chat with context, tools, and your workspace.",
  },
}

/**
 * Assistant overview in the Learn section.
 */
export default function LearnAssistantPage() {
  return (
    <LearnArticle
      title="Assistant"
      description="Pair a capable model with tools, memories, and workflow actions."
    >
      <p>
        The assistant can draft content, answer questions, and invoke tools that respect your permissions. Context from
        the sidebar helps it stay grounded in the task at hand.
      </p>
      <h2>Topics</h2>
      <ul>
        <li>
          <Link href="/learn/assistant/context">Chat and context</Link>
        </li>
        <li>
          <Link href="/learn/assistant/tools">Tools and approvals</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
