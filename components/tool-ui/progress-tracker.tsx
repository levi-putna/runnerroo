"use client";

import { CheckIcon, CircleDotIcon, CircleIcon, ClockIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanStepStatus = "completed" | "in-progress" | "pending";

export type PlanStep = {
  id: string;
  label: string;
  description?: string;
  status: PlanStepStatus;
};

export type ProgressTrackerProps = {
  /** Unique identifier for this tracker instance. */
  id: string;
  steps: PlanStep[];
  /** Total elapsed time in seconds. */
  elapsedTime?: number;
};

/** Active multi-step plan shown in the Context sidebar. */
export type ActivePlan = {
  id: string;
  steps: PlanStep[];
  elapsedTime?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats elapsed seconds into a human-readable duration string (e.g. "2h 5m").
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
}

/** Renders the appropriate status icon for a plan step. */
function StepIcon({ status }: { status: PlanStepStatus }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10">
          <CheckIcon className="size-3 text-foreground/70" />
        </span>
      );
    case "in-progress":
      return (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <CircleDotIcon className="size-3 animate-pulse text-primary" />
        </span>
      );
    case "pending":
    default:
      return (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full">
          <CircleIcon className="size-3 text-muted-foreground/40" />
        </span>
      );
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Compact step-by-step progress tracker used in the Context sidebar when an agent plan is active.
 */
export function ProgressTracker({ id, steps, elapsedTime }: ProgressTrackerProps) {
  return (
    <div id={id} className="flex flex-col gap-0.5">
      {/* Steps */}
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className="flex gap-2.5">
              {/* Icon + connector line */}
              <div className="flex flex-col items-center">
                <StepIcon status={step.status} />
                {!isLast ? <div className="my-0.5 w-px flex-1 bg-border/60" /> : null}
              </div>

              {/* Content */}
              <div className={cn("min-w-0 pb-3", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-xs font-medium leading-snug",
                    step.status === "pending" ? "text-muted-foreground/50" : "text-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description ? (
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/60">
                    {step.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Elapsed time footer */}
      {elapsedTime !== undefined ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/50">
          <ClockIcon className="size-3 shrink-0" />
          <span>{formatElapsed(elapsedTime)}</span>
        </div>
      ) : null}
    </div>
  );
}
