import type { Metadata } from "next"
import Link from "next/link"

import { LineShadowText } from "@/components/site/magic/line-shadow-text"
import { MagicCard } from "@/components/site/magic/magic-card"
import { ModelsCatalogueBrowser } from "@/components/site/models-catalogue-browser"
import { Button } from "@/components/ui/button"
import { getCatalogueGatewayModelsOrFallback } from "@/lib/ai-gateway/get-catalogue-gateway-models"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Models — Features — Dailify",
  description:
    "Browse AI Gateway models available in Dailify: many providers, list pricing passed through, no hidden markup.",
  openGraph: {
    title: "Models — Features — Dailify",
    description:
      "Browse AI Gateway models available in Dailify: many providers, list pricing passed through, no hidden markup.",
  },
}

/**
 * Public model catalogue — same gateway cache as in-app selectors, styled for the marketing site.
 */
export default async function FeaturesModelsPage() {
  const models = await getCatalogueGatewayModelsOrFallback()

  return (
    <div className="flex-1">
      {/* Hero — multi-provider + wholesale pricing (Vercel AI Gateway–style narrative) */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="site-hero-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">AI Gateway catalogue</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
            <LineShadowText as="span" className="text-4xl sm:text-5xl">
              One catalogue, every major provider
            </LineShadowText>
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Unlike single-vendor assistants that only expose that vendor&apos;s models, Dailify routes through the{" "}
            <a
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="https://vercel.com/ai-gateway"
              rel="noreferrer"
              target="_blank"
            >
              Vercel AI Gateway
            </a>{" "}
            so you can pick from a wide range of labs and price points — OpenAI, Anthropic, Google, xAI, and many more —
            without juggling separate accounts for each product surface.
          </p>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground">
            Token and image pricing is passed through at upstream list rates:{" "}
            <strong className="font-medium text-foreground">no Dailify markup</strong> and{" "}
            <strong className="font-medium text-foreground">no hidden platform fees</strong> on model usage. You get the
            same transparency philosophy as{" "}
            <a
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="https://vercel.com/ai-gateway"
              rel="noreferrer"
              target="_blank"
            >
              Vercel&apos;s AI Gateway pricing story
            </a>
            , aligned with how we bill inference inside the app.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/signup">Join</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/features">All features</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Supporting callouts */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <MagicCard className="p-6">
          <h2 className="text-sm font-semibold text-foreground">Same data as the app</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This list is built from the same cached gateway catalogue the product uses for model pickers and cost hints,
            refreshed on a rolling schedule.
          </p>
        </MagicCard>
        <MagicCard className="p-6">
          <h2 className="text-sm font-semibold text-foreground">Switch models freely</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Move between providers for latency, quality, or budget — your workspace is not tied to a single brand the way
            consumer chat apps are.
          </p>
        </MagicCard>
        <MagicCard className="p-6">
          <h2 className="text-sm font-semibold text-foreground">Straightforward columns</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Name, provider, context window, input and output unit pricing, and catalogue release date — nothing else
            cluttering the view.
          </p>
        </MagicCard>
      </section>

      {/* Catalogue table */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Available models</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {models.length} models · pricing shown as published by the gateway (per-million tokens unless noted).
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/learn/assistant/context">Model selection in the app</Link>
          </Button>
        </div>
        <ModelsCatalogueBrowser models={models} />
      </section>
    </div>
  )
}
