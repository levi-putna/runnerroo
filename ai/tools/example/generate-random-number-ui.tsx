"use client";

import { AlertTriangle, Ban, Dice6 } from "lucide-react";
import { AssistantToolCard } from "@/components/tool/assistant-tool-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DynamicToolUIPart,
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  UIMessage,
} from "ai";

type GenerateRandomNumberInput = {
  min?: number;
  max?: number;
};

type GenerateRandomNumberOutput = {
  message: string;
  randomNumber: number;
  min: number;
  max: number;
};

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * UI for the `generateRandomNumber` tool — renders all approval-flow states.
 *
 * State transitions for tools with `needsApproval: true`:
 *   input-streaming  → approval-requested → approval-responded → output-available
 *                                        ↘ output-denied
 *                                        output-error (on execution failure)
 */
export function GenerateRandomNumberUI({ part, addToolApprovalResponse }: Props) {
  // ─── input-streaming / input-available ───────────────────────────────────
  // The model is still generating the tool input — show a skeleton placeholder.

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <AssistantToolCard title="Generate Random Number" icon={Dice6} variant="loading">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3.5 w-12" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        </div>
      </AssistantToolCard>
    );
  }

  // ─── approval-requested ──────────────────────────────────────────────────
  // The tool is paused awaiting user decision. Show parameters and action buttons.

  if (part.state === "approval-requested") {
    const { min = 1, max = 6 } = (part.input as GenerateRandomNumberInput) ?? {};

    return (
      <AssistantToolCard
        title={`Generate Random Number: ${min}–${max}`}
        icon={Dice6}
        headerActions={
          <>
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                addToolApprovalResponse({
                  id: part.approval.id,
                  approved: false,
                  reason: "User rejected the request.",
                })
              }
            >
              Deny
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={() =>
                addToolApprovalResponse({ id: part.approval.id, approved: true })
              }
            >
              Approve
            </Button>
          </>
        }
      >
        {/* Parameter summary for the user to review before approving */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">Minimum</div>
            <div className="font-mono bg-muted px-1.5 py-0.5 rounded">{min}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Maximum</div>
            <div className="font-mono bg-muted px-1.5 py-0.5 rounded">{max}</div>
          </div>
        </div>
      </AssistantToolCard>
    );
  }

  // ─── approval-responded ──────────────────────────────────────────────────
  // The user responded; waiting for the server to execute (if approved).

  if (part.state === "approval-responded") {
    const { min = 1, max = 6 } = (part.input as GenerateRandomNumberInput) ?? {};

    if (part.approval.approved) {
      return (
        <AssistantToolCard
          title={`Generate Random Number: ${min}–${max}`}
          icon={Dice6}
          variant="loading"
        >
          <div className="text-xs text-muted-foreground">Approved — generating number…</div>
        </AssistantToolCard>
      );
    }

    return (
      <AssistantToolCard
        title={`Generate Random Number: ${min}–${max}`}
        icon={Dice6}
        variant="denied"
      >
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <Ban size={12} className="shrink-0" />
          <span>{part.approval.reason ?? "Operation was denied."}</span>
        </div>
      </AssistantToolCard>
    );
  }

  // ─── output-denied ───────────────────────────────────────────────────────
  // Server confirmed the denial after the round-trip.

  if (part.state === "output-denied") {
    const { min = 1, max = 6 } = (part.input as GenerateRandomNumberInput) ?? {};

    return (
      <AssistantToolCard
        title={`Generate Random Number: ${min}–${max}`}
        icon={Dice6}
        variant="denied"
      >
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <Ban size={12} className="shrink-0" />
          <span>{part.approval.reason ?? "Operation was denied."}</span>
        </div>
      </AssistantToolCard>
    );
  }

  // ─── output-available ────────────────────────────────────────────────────
  // Tool executed successfully — display the result.

  if (part.state === "output-available") {
    const result = part.output as GenerateRandomNumberOutput;

    return (
      <AssistantToolCard
        title={`Random Number: ${result.randomNumber} (${result.min}–${result.max})`}
        icon={Dice6}
        variant="success"
      >
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">Minimum</div>
            <div className="font-mono bg-muted px-1.5 py-0.5 rounded">{result.min}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Maximum</div>
            <div className="font-mono bg-muted px-1.5 py-0.5 rounded">{result.max}</div>
          </div>
          <div className="col-span-2 space-y-1">
            <div className="text-muted-foreground">Generated Number</div>
            <div className="font-mono bg-muted px-1.5 py-0.5 rounded font-semibold text-lg">
              {result.randomNumber}
            </div>
          </div>
        </div>
      </AssistantToolCard>
    );
  }

  // ─── output-error ────────────────────────────────────────────────────────
  // Execution failed — display the error text.

  if (part.state === "output-error") {
    const { min = 1, max = 6 } = (part.input as GenerateRandomNumberInput) ?? {};

    return (
      <AssistantToolCard
        title={`Generate Random Number: ${min}–${max}`}
        icon={Dice6}
        variant="error"
      >
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{part.errorText ?? "An unexpected error occurred."}</span>
        </div>
      </AssistantToolCard>
    );
  }

  return null;
}
