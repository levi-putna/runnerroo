import { anthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"

export const runtime = "edge"

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: `You are Runneroo AI, an intelligent assistant embedded in a workflow automation platform.
You help users build, debug, and optimize their automation workflows.
You have deep knowledge of workflow patterns, API integrations, JavaScript/TypeScript, and Vercel infrastructure.
Be concise and practical. When suggesting code, use TypeScript.`,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
