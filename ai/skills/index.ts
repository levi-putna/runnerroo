import type { PlanningResult } from "@/ai/agents/planning-agent";
import { runnerooDomainSkill } from "@/ai/skills/runneroo-domain";
import { toneSkill } from "@/ai/skills/tone";
import { toolBehaviourSkill } from "@/ai/skills/tool-behaviour";

/**
 * Composes the final system prompt: domain baseline, tone, tool rules, optional planning
 * and memory sections, optional integrations and invoke-workflow appendices.
 */
export function buildRunnerAssistantInstructions({
  planning,
  memoryContext,
  integrationsContext,
  workflowsInvokeContext,
}: {
  planning?: PlanningResult;
  memoryContext?: string;
  integrationsContext?: string;
  workflowsInvokeContext?: string;
} = {}): string {
  let base = `${runnerooDomainSkill}

${toneSkill}

${toolBehaviourSkill}`;

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
