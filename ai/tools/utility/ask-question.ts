import { tool } from "ai";
import { z } from "zod";

/**
 * Client-completed tool: the model supplies a question and fixed options; the user picks one
 * in the UI and the client calls {@link import('ai').ChatAddToolOutputFunction | addToolOutput}.
 * There is no server `execute` — completion happens in the browser.
 */
export const askQuestion = tool({
  description:
    "Ask the user a question with predefined answer options (3–5). Use when a discrete choice is required. For free-text answers, ask in normal chat instead.",
  inputSchema: z.object({
    question: z.string().describe("Short, focused question."),
    options: z
      .array(z.string())
      .min(3)
      .max(5)
      .describe("Three to five mutually exclusive options."),
  }),
});
