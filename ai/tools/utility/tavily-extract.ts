import { tavilyExtract as tavilyExtractSdk } from "@tavily/ai-sdk";

/**
 * Extracts readable content from explicit URLs via Tavily (batch-friendly).
 *
 * Requires `TAVILY_API_KEY` on the server.
 */
export const tavilyExtract = tavilyExtractSdk({
  apiKey: process.env.TAVILY_API_KEY,
});
