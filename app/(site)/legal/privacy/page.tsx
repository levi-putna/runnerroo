import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy policy — Dailify",
  description: "How Dailify handles personal information and analytics.",
  openGraph: {
    title: "Privacy policy — Dailify",
    description: "How Dailify handles personal information and analytics.",
  },
}

/**
 * Privacy policy placeholder — replace with counsel-reviewed copy and subprocessors before launch.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <header className="mb-10 border-b border-border/60 pb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Privacy policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: 10 May 2026 (placeholder)</p>
      </header>

      <div className="site-markdown space-y-6">
        <p>
          <strong>This page is placeholder copy only.</strong> It is not legal advice. Work with privacy counsel to
          align with Australian privacy law (including the Australian Privacy Principles) and any other regions you
          serve.
        </p>
        <h2>What we collect</h2>
        <p>
          We collect account details (such as email), product usage required to operate the service, and content you
          choose to store (for example workflow definitions and chat transcripts).
        </p>
        <h2>Why we collect it</h2>
        <p>
          We use this information to authenticate you, run workflows, improve reliability, and respond to support
          requests. Analytics should be minimised and documented in a production policy.
        </p>
        <h2>Retention</h2>
        <p>
          Records are kept only as long as needed for the purposes described in your final policy, including legal and
          security obligations.
        </p>
        <h2>Contact</h2>
        <p>
          For privacy questions, contact us via the details on the <Link href="/contact">Contact</Link> page once your
          inbox is configured.
        </p>
      </div>
    </div>
  )
}
