import type { PlanningResult } from "@/ai/agents/planning-agent";
import { dailifyDomainSkill } from "@/ai/skills/dailify-domain";
import { toneSkill } from "@/ai/skills/tone";
import { toolBehaviourSkill } from "@/ai/skills/tool-behaviour";
import type { AssistantSettings } from "@/lib/assistant-settings/types";
import { buildAssistantSettingsPromptBlock } from "@/lib/assistant-settings/build-assistant-settings-prompt";

/**
 * Composes the final system prompt: domain baseline, tone, tool rules, optional planning
 * and memory sections, optional integrations and invoke-workflow appendices.
 */
export function buildRunnerAssistantInstructions({
  planning,
  memoryContext,
  integrationsContext,
  workflowsInvokeContext,
  assistantSettings,
}: {
  planning?: PlanningResult;
  memoryContext?: string;
  integrationsContext?: string;
  workflowsInvokeContext?: string;
  /** Per-user assistant behaviour preferences. Injected directly after the date block. */
  assistantSettings?: AssistantSettings;
} = {}): string {
  const now = new Date();
  const currentDate = now.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentTime = now.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  let base = `${dailifyDomainSkill}

${toneSkill}

${toolBehaviourSkill}

## Current date and time

Today is ${currentDate} at ${currentTime}.`;

  if (assistantSettings) {
    base += `\n\n${buildAssistantSettingsPromptBlock(assistantSettings)}`;
  }

  if (planning) {
    base += `

## Planning context

The following thinking note was produced by a planning pass over the conversation.
Use it to guide your response:

${planning.thinking}`;

    if (planning.skill) {
      base += `

## Active skill: ${planning.skill.name}

The planning step determined that the following skill is relevant to this request.
Follow the guidance below to handle the user’s request:

${planning.skill.body}`;
    }
  }

  if (memoryContext) {
    base += `

## Relevant user memories

The bullets below are retrieved from this user’s saved memory store. Each line includes a stable \`id=\` you must not invent or change.

How to use them:
- Treat them as hints, not ground truth. If anything conflicts with the user’s latest message, prefer the message and clarify if needed.
- Do not mention memory ids or the existence of a memory system unless the user asks about saved preferences.
- Respect ephemeral rows: lines marked with \`(expires …)\` apply only until that time.
- If the list is empty or nothing fits, do not fabricate preferences or history.

Facts:

${memoryContext}`;
  }

  if (integrationsContext) {
    base += `

## Connected integrations

${integrationsContext}`;
  }

  if (workflowsInvokeContext) {
    base += `

## Invoke workflows (assistant tools)

The following tools run persisted workflows owned by this user. Use them only when the user clearly wants automation executed—not for hypothetical graphs.

${workflowsInvokeContext}`;
  }

  return base;
}
