import { tavilyCrawl as tavilyCrawlSdk } from "@tavily/ai-sdk";

/**
 * Breadth-first site crawl via Tavily. Use when the user needs many pages from one site,
 * not a single snippet answer.
 *
 * Requires `TAVILY_API_KEY` on the server.
 */
export const tavilyCrawl = tavilyCrawlSdk({
  apiKey: process.env.TAVILY_API_KEY,
  limit: 25,
});
