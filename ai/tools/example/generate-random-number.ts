import { tool } from "ai";
import { z } from "zod";

/**
 * Generates a random integer within a user-specified range.
 *
 * This is an example tool that demonstrates the AI SDK's human-in-the-loop
 * approval flow (`needsApproval: true`). Execution is paused after the model
 * invokes it and resumes only once the user approves or denies the request.
 */
export const generateRandomNumber = tool({
  description:
    "Generate a random number within a specified range. Requires user approval before execution. Default range is 1 to 6.",
  inputSchema: z.object({
    min: z
      .number()
      .int()
      .min(1)
      .default(1)
      .optional()
      .describe("Minimum value (inclusive). Defaults to 1."),
    max: z
      .number()
      .int()
      .min(1)
      .default(6)
      .optional()
      .describe("Maximum value (inclusive). Defaults to 6."),
  }),
  needsApproval: true,
  execute: async ({ min = 1, max = 6 }) => {
    if (min > max) {
      throw new Error(
        `Invalid range: min (${min}) must be less than or equal to max (${max}).`
      );
    }

    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

    return { message: `Generated random number: ${randomNumber}`, randomNumber, min, max };
  },
});
