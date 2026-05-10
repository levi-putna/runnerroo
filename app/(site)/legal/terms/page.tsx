import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of service | Dailify",
  description: "Terms of service for the Dailify website and product.",
  openGraph: {
    title: "Terms of service | Dailify",
    description: "Terms of service for the Dailify website and product.",
  },
}

/**
 * Terms of service placeholder: replace with counsel-reviewed copy before launch.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <header className="mb-10 border-b border-border/60 pb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Terms of service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: 10 May 2026 (placeholder)</p>
      </header>

      <div className="site-markdown space-y-6">
        <p>
          <strong>This page is placeholder copy only.</strong> It is not legal advice. Engage qualified counsel to
          prepare terms that match your entity, jurisdictions, and product behaviour before you invite customers.
        </p>
        <h2>Using Dailify</h2>
        <p>
          By accessing the website or creating an account, you agree to follow these terms and any acceptable use rules
          we publish. If you disagree, do not use the service.
        </p>
        <h2>Accounts</h2>
        <p>
          You are responsible for activity under your account. Keep credentials secret and notify us if you suspect
          compromise.
        </p>
        <h2>Service changes</h2>
        <p>
          We may modify, suspend, or discontinue features to keep the platform reliable and secure. Where a change
          materially affects you, we will aim to give reasonable notice.
        </p>
      </div>
    </div>
  )
}
