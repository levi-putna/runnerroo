"use client"

import * as React from "react"
import { ChevronDown, CircleCheck, GitBranch, Inbox, ListTree, Timer } from "lucide-react"

import { AnimatedBeam } from "@/components/site/magic/animated-beam"
import { cn } from "@/lib/utils"

type HeroStage = {
  id: string
  title: string
  subtitle: string
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}

const WORKFLOW_HERO_STAGES: HeroStage[] = [
  {
    id: "trigger",
    title: "Trigger",
    subtitle: "Schedule, webhook, or manual start",
    Icon: Timer,
  },
  {
    id: "steps",
    title: "Steps",
    subtitle: "Integrations and logic in order",
    Icon: ListTree,
  },
  {
    id: "branch",
    title: "Branch",
    subtitle: "Route by outcome or data",
    Icon: GitBranch,
  },
  {
    id: "approval",
    title: "Approval",
    subtitle: "Human sign-off when required",
    Icon: Inbox,
  },
  {
    id: "done",
    title: "Complete",
    subtitle: "History and artefacts recorded",
    Icon: CircleCheck,
  },
]

/**
 * Renders a single stage pill for {@link LearnWorkflowsHero}.
 */
function WorkflowHeroStageCard({
  title,
  subtitle,
  Icon,
  className,
}: {
  title: string
  subtitle: string
  Icon: HeroStage["Icon"]
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg border border-border/80 bg-card/90 px-2 py-3 text-center shadow-sm backdrop-blur-sm sm:px-3",
        className,
      )}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground"
        aria-hidden
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight text-foreground">{title}</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * Learn hub hero — linear “run spine” showing how a workflow moves from trigger to completion.
 *
 * @param variant - `standalone` includes the intro block; `embedded` is a slimmer shell for cards (e.g. marketing bento).
 */
export function LearnWorkflowsHero({
  className,
  variant = "standalone",
}: {
  className?: string
  variant?: "standalone" | "embedded"
}) {
  const embedded = variant === "embedded"

  return (
    <section
      className={cn(
        embedded
          ? "overflow-hidden rounded-xl border border-dashed border-border/80 bg-background/60"
          : "overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/35 via-background to-background",
        className,
      )}
      aria-label={embedded ? "How a workflow run moves from trigger to completion" : undefined}
      aria-labelledby={embedded ? undefined : "learn-workflows-hero-heading"}
    >
      {/* Intro copy — full marketing / learn header only in standalone */}
      {embedded ? null : (
        <div className="border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            How it fits together
          </p>
          <h2 id="learn-workflows-hero-heading" className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            One run, many checkpoints
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Each execution follows the graph: automated steps carry the load, branches decide what happens next, and
            approvals pause the run until the right person continues it.
          </p>
        </div>
      )}

      {/* Mobile — stacked with chevrons */}
      <div
        className={cn(
          "flex flex-col gap-1 md:hidden",
          embedded ? "px-3 py-4 sm:px-4" : "px-4 py-5 sm:px-6",
        )}
      >
        {WORKFLOW_HERO_STAGES.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <WorkflowHeroStageCard title={stage.title} subtitle={stage.subtitle} Icon={stage.Icon} className="w-full" />
            {index < WORKFLOW_HERO_STAGES.length - 1 ? (
              <div className="flex justify-center py-0.5" aria-hidden>
                <ChevronDown className="size-4 text-muted-foreground/80" />
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {/* Desktop — horizontal spine with animated beam */}
      <div
        className={cn(
          "relative hidden md:block",
          embedded ? "min-h-[148px] px-2 pb-4 pt-1 sm:px-3" : "min-h-[168px] px-3 pb-5 pt-2 sm:px-5",
        )}
      >
        <AnimatedBeam className="opacity-90" fromX={6} toX={94} y={embedded ? 44 : 48} />
        <div
          className={cn(
            "relative z-[1] mx-auto flex max-w-[52rem] items-end justify-between gap-1.5 sm:gap-2 lg:gap-3",
            embedded ? "pt-8" : "pt-10",
          )}
        >
          {WORKFLOW_HERO_STAGES.map((stage) => (
            <WorkflowHeroStageCard key={stage.id} title={stage.title} subtitle={stage.subtitle} Icon={stage.Icon} />
          ))}
        </div>
      </div>
    </section>
  )
}
