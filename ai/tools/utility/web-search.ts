import { tavilySearch } from "@tavily/ai-sdk";

/**
 * Server-side web search using Tavily. Optimised for short answers plus source URLs.
 *
 * Set `TAVILY_API_KEY` on the server (never expose to the browser). If the key is missing,
 * the tool still registers but Tavily requests will fail at execution time.
 */
export const webSearch = tavilySearch({
  apiKey: process.env.TAVILY_API_KEY,
  searchDepth: "basic",
  includeAnswer: true,
  maxResults: 5,
});
