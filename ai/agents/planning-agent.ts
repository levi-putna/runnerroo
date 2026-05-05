import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import type { LanguageModelUsage, UIMessage } from "ai";
import { z } from "zod";

import { buildSkillSummary, loadSkill, type SkillMeta } from "@/ai/skills/skill-loader";

/**
 * Resolves the Gateway model id used for the skill-selection planning pass.
 */
export function resolvePlanningModelId(): string {
  return (
    process.env.PLANNING_MODEL ??
    process.env.NEXT_PUBLIC_ASSISTANT_MODEL ??
    "google/gemini-2.0-flash"
  );
}

const PLANNING_MODEL = resolvePlanningModelId();

export interface PlanningResult {
  /** Short thinking note for the main assistant */
  thinking: string;
  /** Selected skill name, or null if no skill applies */
  skillName: string | null;
  /** The loaded skill metadata, or null */
  skill: SkillMeta | null;
  /** Token usage from the planning LLM call (same turn as this object). */
  usage: LanguageModelUsage;
}

/**
 * Runs a lightweight planning pass over the conversation.
 *
 * 1. Reviews the recent conversation to understand the user's intent
 * 2. Assesses which skill (if any) is relevant
 * 3. When invoke workflows are supplied, weighs whether the user's enquiry fits an assistant workflow tool
 * 4. Returns a thinking note and the selected skill content
 *
 * @param messages - The current conversation UIMessages
 * @param providerOptions - Optional Gateway-level metadata (user / conversation tags).
 */
export async function runPlanningAgent(
  messages: UIMessage[],
  {
    providerOptions,
    invokeWorkflowsPlanningAppendix,
  }: {
    providerOptions?: ProviderOptions;
    /** Rendered catalogue of invoke-compatible workflows (assistant tools); omit when empty. */
    invokeWorkflowsPlanningAppendix?: string;
  } = {},
): Promise<PlanningResult> {
  const skillSummary = buildSkillSummary();

  const trimmedInvokeAppendix = invokeWorkflowsPlanningAppendix?.trim();
  const invokeWorkflowSection =
    trimmedInvokeAppendix && trimmedInvokeAppendix.length > 0
      ? `

## Invoke workflows this user can run via assistant tools

Each row lists the assistant **tool name** (backticks), workflow metadata, and declared invoke inputs.

${trimmedInvokeAppendix}

### Invoke workflows and your thinking note

- Compare the user's enquiry with each workflow's name, summary, and declared inputs.
- When **one** workflow clearly fits what they want executed with structured inputs, add **one sentence** that explicitly recommends using that assistant tool, naming the exact tool key in backticks (for example: **Use assistant tool \`wf…\`** to run **…** because …).
- When several could fit, briefly name the strongest candidate or flag ambiguity — avoid repeating the full catalogue.
- When none fit, omit workflow tooling entirely — do not invent tool keys or workflows.

`
      : "";

  const systemPrompt = `You are a planning assistant for Runnerroo AI (workflow automation + in-app assistant).

Review the conversation below and produce:
1. A skill selection — pick the most relevant skill from the list below, or "none" if no skill applies.
2. A concise thinking note (2–4 sentences) visible to the user that:
   - If a skill was selected: opens with "Using the **<skill-name>** skill — <one short sentence on why this skill was selected for this request>."
   - Then adds 1–3 sentences on: what the user is asking for, important technical context (nodes, errors, APIs mentioned), and any nuances worth addressing.
   - If invoke workflows are listed above and one clearly applies to the enquiry, weave in the recommended assistant tool sentence there (still keep the overall note brief).
   - If no skill: just 2–3 sentences summarising what the user needs and any relevant context.

## Available skills

${skillSummary}
${invokeWorkflowSection}
## Rules

- Only select a skill if the user's request clearly matches its purpose and triggers.
- If the request is a general question or conversation, select "none".
- Keep the thinking note brief — it is shown to the user as a visible planning step.
- Do not write a response to the user in the thinking note.`;

  // Summarise the last 6 messages for brevity
  const conversationText = messages
    .slice(-6)
    .map((m) => {
      const text = m.parts
        .filter((p): p is Extract<(typeof m.parts)[number], { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join(" ");
      return `${m.role === "user" ? "User" : "Assistant"}: ${text}`;
    })
    .filter((line) => line.split(": ")[1]?.trim())
    .join("\n");

  const { object, usage } = await generateObject({
    model: gateway(PLANNING_MODEL),
    system: systemPrompt,
    prompt: `Conversation:\n${conversationText}`,
    ...(providerOptions ? { providerOptions } : {}),
    schema: z.object({
      thinking: z.string().describe("A concise 2-4 sentence thinking note for the main assistant"),
      skill: z
        .string()
        .describe(
          'The name of the selected skill (e.g. "workflow-builder", "runneroo-product"), or "none" if no skill applies'
        ),
    }),
  });

  const skillName = object.skill === "none" ? null : object.skill;
  const skill = skillName ? (loadSkill(skillName) ?? null) : null;

  return {
    thinking: object.thinking,
    skillName,
    skill,
    usage,
  };
}
