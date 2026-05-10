import type { Metadata } from "next"
import Link from "next/link"
import { Bot, Inbox, Layers, Sparkles, Workflow } from "lucide-react"

import { LearnWorkflowsHero } from "@/components/site/learn-workflows-hero"
import { LineShadowText } from "@/components/site/magic/line-shadow-text"
import { MagicCard } from "@/components/site/magic/magic-card"
import { ShineBorder } from "@/components/site/magic/shine-border"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Features | Dailify",
  description: "Assistant chat, visual workflows, approvals, and durable runs in one workspace.",
  openGraph: {
    title: "Features | Dailify",
    description: "Assistant chat, visual workflows, approvals, and durable runs in one workspace.",
  },
}

/**
 * Product features page: assistant and workflows with bento-style explanations.
 */
export default function FeaturesPage() {
  return (
    <div className="flex-1">
      {/* Intro */}
      <section className="border-b border-border/60 bg-muted/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Features</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            <LineShadowText as="span" className="text-4xl sm:text-5xl">
              Assistant + workflows
            </LineShadowText>
            <span className="text-foreground">, designed as one system.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Dailify is where diagrams become operational truth: the assistant explores and drafts, while workflows carry
            execution, approvals, and artefacts forward with a paper trail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/signup">Join</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/learn">Learn how it works</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/features/models">Browse models</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Assistant chapter */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Assistant</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A conversational layer with tools, memories, and model choice, grounded in the same workspace you operate
              day to day.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MagicCard className="p-8">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="size-5 text-primary" aria-hidden />
              Models and tools
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Pick the right model for the job, stream responses, and let the assistant call tools when it needs fresh
              data, without leaving the thread you already trust.
            </p>
          </MagicCard>
          <MagicCard className="p-8">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Bot className="size-5 text-primary" aria-hidden />
              Context sidebar
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Inspect usage, memories, and attachments alongside the conversation so reviewers can see what informed each
              answer.
            </p>
          </MagicCard>
        </div>
      </section>

      {/* Workflows chapter */}
      <section className="border-t border-border/60 bg-muted/10 py-16">
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Workflows</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A visual graph for orchestration: triggers, branches, integrations, and human checkpoints, with history you
              can audit.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ShineBorder className="lg:col-span-2" borderRadius={14}>
              <div className="space-y-4 p-8">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Workflow className="size-4 text-primary" aria-hidden />
                  Canvas orchestration
                </div>
                <p className="text-sm text-muted-foreground">
                  Lay out the spine of your process, branch for exceptions, and keep naming honest so the next engineer
                  understands intent at a glance.
                </p>
                {/* Run spine: same component as Learn /workflows, embedded in the bento */}
                <div className="mt-5">
                  <LearnWorkflowsHero variant="embedded" />
                </div>
              </div>
            </ShineBorder>

            <MagicCard className="flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Inbox className="size-4 text-primary" aria-hidden />
                  Approvals
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Sensitive steps wait for explicit human consent, surfaced in the inbox so work does not stall in the
                  dark.
                </p>
              </div>
              <Layers className="mt-8 size-10 text-border" aria-hidden />
            </MagicCard>
          </div>
        </div>
      </section>
    </div>
  )
}
