import type { Metadata } from "next"
import Link from "next/link"
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle,
  FileText,
  Inbox,
  MessageSquare,
  Sparkles,
  Workflow,
} from "lucide-react"

import { LearnWorkflowsHero } from "@/components/site/learn-workflows-hero"
import { AnimatedBeam } from "@/components/site/magic/animated-beam"
import { LineShadowText } from "@/components/site/magic/line-shadow-text"
import { MagicCard } from "@/components/site/magic/magic-card"
import { ShineBorder } from "@/components/site/magic/shine-border"
import { SiteHomeHeroConversation } from "@/components/site/site-home-hero-conversation"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Dailify — Your personal AI executive assistant",
  description:
    "Dailify gives you a personal AI executive assistant that handles coordination, routes approvals, and runs your recurring processes so you can focus on the work that matters.",
  openGraph: {
    title: "Dailify — Your personal AI executive assistant",
    description:
      "Dailify gives you a personal AI executive assistant that handles coordination, routes approvals, and runs your recurring processes so you can focus on the work that matters.",
  },
}

/**
 * Public landing page: executive-assistant product positioning with hero chat,
 * feature bento, how-it-works, use cases, and CTA.
 */
export default function SiteHomePage() {
  return (
    <div className="flex-1">

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="site-hero-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:flex-row sm:items-center sm:px-6 lg:py-28">

          {/* Copy */}
          <div className="max-w-xl flex-1 space-y-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Your personal AI executive assistant
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              <LineShadowText as="span" className="text-4xl sm:text-5xl lg:text-6xl">
                The assistant
              </LineShadowText>{" "}
              <span className="text-foreground">that actually handles things.</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Dailify runs your processes, routes your approvals, and keeps your team moving.
              Tell it what matters and it takes it from there.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/signup">Get started free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/features">See how it works</Link>
              </Button>
            </div>
          </div>

          {/* Hero visual — animated mock conversation */}
          <div className="flex w-full flex-1 justify-center sm:justify-end">
            <SiteHomeHeroConversation />
          </div>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────── */}
      <section className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-around sm:text-left">
            <div>
              <p className="text-sm font-semibold text-foreground">Handles coordination</p>
              <p className="mt-1 max-w-[18ch] text-sm text-muted-foreground">
                Schedules, clashes, and follow-ups without the back-and-forth.
              </p>
            </div>
            <div className="hidden h-10 w-px bg-border/60 sm:block" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">Routes approvals</p>
              <p className="mt-1 max-w-[18ch] text-sm text-muted-foreground">
                The right people see the right requests at the right time.
              </p>
            </div>
            <div className="hidden h-10 w-px bg-border/60 sm:block" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">Runs your processes</p>
              <p className="mt-1 max-w-[18ch] text-sm text-muted-foreground">
                Recurring workflows run on schedule with a full audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature bento ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl space-y-10 px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Everything your assistant needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            From a quick question to a complex multi-step workflow, Dailify has the tools to get it done.
          </p>
        </div>

        {/* Grid: large workflow cell + two smaller cells */}
        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">

          {/* Large cell: workflow automation */}
          <ShineBorder className="md:col-span-2 md:row-span-2" borderRadius={16} borderWidth={1}>
            <div className="space-y-5 p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
                <Workflow className="size-3.5" aria-hidden />
                Workflow automation
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                Build it once. Run it on repeat.
              </h3>
              <p className="text-muted-foreground">
                Turn any recurring process into a visual workflow. Triggers, branches,
                integrations, and human checkpoints. Every run is logged so nothing disappears.
              </p>
              {/* Embedded workflow spine */}
              <div className="mt-2">
                <LearnWorkflowsHero variant="embedded" />
              </div>
            </div>
          </ShineBorder>

          {/* Smart inbox */}
          <MagicCard className="flex flex-col gap-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
              <Inbox className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">Smart inbox</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Approvals and decisions surface in one place. Clear the queue and keep everything moving.
              </p>
            </div>
          </MagicCard>

          {/* Persistent memory */}
          <MagicCard className="flex flex-col gap-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
              <BrainCircuit className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">Remembers context</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your assistant keeps track of preferences, past decisions, and ongoing projects so you never repeat yourself.
              </p>
            </div>
          </MagicCard>
        </div>

        {/* Second row of smaller bento cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <MagicCard className="flex flex-col gap-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
              <MessageSquare className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">Natural conversation</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Just talk to it. Switch between models, share files, and get answers grounded in your workspace.
              </p>
            </div>
          </MagicCard>

          <MagicCard className="flex flex-col gap-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
              <CalendarClock className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">Scheduled runs</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Morning briefings, weekly reports, end-of-day summaries. Set the schedule and your assistant handles the rest.
              </p>
            </div>
          </MagicCard>

          <MagicCard className="flex flex-col gap-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">Best model for the job</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick from dozens of AI models or let Dailify route automatically based on the task and your budget.
              </p>
            </div>
          </MagicCard>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="border-t border-border/60 bg-muted/15 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Up and running in minutes
            </h2>
            <p className="mt-3 text-muted-foreground">
              No complex setup. Just describe what you need and Dailify figures out the rest.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="relative">
              {/* Connecting line on desktop */}
              <div className="absolute left-full top-5 hidden h-px w-full -translate-x-4 bg-border/60 sm:block" aria-hidden />
              <div className="relative">
                <div className="relative mb-6 min-h-[120px] overflow-hidden rounded-xl border border-dashed border-border/80 bg-background/60">
                  <AnimatedBeam className="opacity-80" fromX={10} toX={90} y={50} />
                  <div className="relative z-[1] flex h-full items-center justify-center px-6 py-8">
                    <MessageSquare className="size-8 text-muted-foreground" aria-hidden />
                  </div>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Step 1</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Describe what you need</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Have a conversation with your assistant. Tell it about your recurring tasks, who approves what, and how you like things done.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute left-full top-5 hidden h-px w-full -translate-x-4 bg-border/60 sm:block" aria-hidden />
              <div className="relative">
                <div className="mb-6 overflow-hidden rounded-xl border border-dashed border-border/80 bg-background/60">
                  <div className="flex items-center justify-between px-6 py-8">
                    <div className="h-8 w-14 rounded-md border border-border bg-muted/40" />
                    <div className="h-px w-8 bg-border" aria-hidden />
                    <div className="h-8 w-14 rounded-md border border-border bg-muted/40" />
                    <div className="h-px w-8 bg-border" aria-hidden />
                    <div className="h-8 w-14 rounded-md border border-border bg-muted/40" />
                  </div>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Step 2</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Your workflow is built</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dailify turns your instructions into a repeatable workflow with steps, branches, and checkpoints you can inspect and adjust.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="mb-6 flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/80 bg-background/60 py-8">
                <CheckCircle className="size-8 text-primary" aria-hidden />
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Step 3</p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">You stay in control</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Approve, skip, or redirect at any point. Full history means you always know what happened and why.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use cases ──────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              What people use it for
            </h2>
            <p className="mt-3 text-muted-foreground">
              Dailify adapts to how you work, not the other way around.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {/* Use case 1 */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-6">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
                <CalendarClock className="size-5" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">Daily briefings</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start every morning with a summary of your calendar, outstanding approvals, and the three things that need your attention.
              </p>
              <Link
                href="/learn/assistant"
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Learn more
              </Link>
            </div>

            {/* Use case 2 */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-6">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
                <Inbox className="size-5" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">Approval routing</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Route purchase requests, leave approvals, and document sign-offs to the right people automatically. No more chasing.
              </p>
              <Link
                href="/learn/workflows"
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Learn more
              </Link>
            </div>

            {/* Use case 3 */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-6">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary">
                <FileText className="size-5" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">Recurring reports</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Weekly status updates, end-of-month summaries, and board packs generated and delivered on schedule.
              </p>
              <Link
                href="/learn/workflows/runs"
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <section className="border-t border-border/60 bg-muted/15 py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="max-w-lg">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Your assistant is ready when you are.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Get started in minutes. No complicated setup, no long onboarding. Just sign up and start telling Dailify what to handle.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  )
}
