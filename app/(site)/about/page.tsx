import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "About — Dailify",
  description: "The story behind Dailify — why it was built, and who built it.",
  openGraph: {
    title: "About — Dailify",
    description: "The story behind Dailify — why it was built, and who built it.",
  },
}

/**
 * About page — the origin story of Dailify and the person behind it.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:py-24">

      {/* Page heading */}
      <header className="mb-14">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          The story of Dailify
        </h1>
      </header>

      {/* Origin story */}
      <section className="mb-16 space-y-6 text-lg leading-relaxed text-muted-foreground">
        <p>
          Like a lot of people working in technology, I got genuinely excited when generative AI started
          moving fast. Not just the hype — the real, tangible shift in what was becoming possible with
          tools like{" "}
          <span className="text-foreground">Cursor</span>,{" "}
          <span className="text-foreground">Claude</span>, and{" "}
          <span className="text-foreground">n8n</span>. As both an engineer and a product person, I could
          see the potential clearly.
        </p>

        <p>
          But I kept running into the same gap. I wanted a single assistant that could help me with the
          repetitive, time-consuming tasks in my day-to-day life — reliably, and in a way that felt like
          it actually represented me.
        </p>

        <p>
          Claude was impressive, but it never quite did things consistently the way I wanted. It lacked
          just enough control to make me comfortable using it on my behalf. n8n was powerful, but it felt
          like a slightly disconnected, technical tool — more infrastructure than assistant. And the various
          open-source alternatives, while exciting, came with security considerations I wasn&apos;t
          comfortable managing in my personal workflow.
        </p>

        <p>
          So I built Dailify.
        </p>
      </section>

      {/* Vision block */}
      <section className="mb-16 rounded-2xl bg-muted/50 px-8 py-10 sm:px-10">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">The vision</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Dailify is the single, simple tool I wished existed — one that lets you realise the genuine
          potential of AI in your day-to-day life. Not a sprawling platform. Not a raw API wrapper. Just
          a tool that works the way you want, does what you ask, and stays out of the way the rest of
          the time.
        </p>
      </section>

      {/* Founder section */}
      <section className="mb-16">
        <h2 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">The person behind it</h2>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
          {/* Text */}
          <div className="space-y-4 text-muted-foreground">
            <p className="text-lg leading-relaxed">
              Dailify is built and maintained by{" "}
              <span className="font-medium text-foreground">Levi Putna</span> — a developer and product
              person based in Australia with a background spanning e-commerce platforms, lottery retail,
              and web application development.
            </p>
            <p className="leading-relaxed">
              Levi holds a Bachelor of Information Technology and Business/Commerce, and has spent his
              career building software that handles real scale — from platforms servicing tens of
              thousands of customers to systems processing hundreds of millions of dollars in
              transactions annually.
            </p>
            <p className="leading-relaxed">
              Dailify is a personal project born from a genuine need. Every line of code is written by
              Levi, which means the tool evolves directly from the same real-world usage it was
              designed to serve.
            </p>

            <div className="pt-2">
              <Link
                href="https://www.twistedbrackets.com/about/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                Read more about Levi
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border/60 pt-12">
        <p className="text-muted-foreground">
          Want to try it?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground">
            Create a free account
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground">
            get in touch
          </Link>
          .
        </p>
      </section>

    </div>
  )
}
