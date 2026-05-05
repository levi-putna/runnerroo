import { tool } from "ai";
import { z } from "zod";

/**
 * Placeholder tool so the agent loop can be exercised end-to-end.
 * Replace with real knowledge-base or retrieval later.
 */
export const getStrataGlossaryTerm = tool({
  description:
    "Looks up a short definition of a strata management term for the user.",
  inputSchema: z.object({
    term: z
      .string()
      .describe("The term to define, e.g. sinking fund, special levy"),
  }),
  execute: async ({ term }) => ({
    term,
    definition: `Placeholder definition for "${term}". Wire this tool to your glossary or knowledge base.`,
  }),
});
