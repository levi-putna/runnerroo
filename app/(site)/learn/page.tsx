import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Learn | Dailify",
  description: "Documentation-style guides for workflows and the assistant.",
  openGraph: {
    title: "Learn | Dailify",
    description: "Documentation-style guides for workflows and the assistant.",
  },
}

/**
 * Learn hub landing: entry point for documentation topics.
 */
export default function LearnIndexPage() {
  return (
    <LearnArticle
      title="Learn Dailify"
      description="Practical guides for designing workflows and collaborating with the assistant."
    >
      <p>
        Start with <Link href="/learn/getting-started">Getting started</Link>, then explore{" "}
        <Link href="/learn/workflows">Workflows</Link> and the <Link href="/learn/assistant">Assistant</Link>.
      </p>
      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/learn/getting-started">Getting started</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/features">Product features</Link>
        </Button>
      </div>
    </LearnArticle>
  )
}
