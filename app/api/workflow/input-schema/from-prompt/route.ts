import { runWorkflowInputSchemaFromPromptAgent } from "@/ai/agents/workflow-input-schema-from-prompt-agent"
import { buildRunnerGatewayProviderOptions } from "@/lib/ai-gateway/runner-gateway-tracking"
import { createClient } from "@/lib/supabase/server"
import { normaliseWorkflowInputSchemaPromptFlavourCandidate } from "@/lib/workflows/input-schema-from-prompt-flavours"

export const maxDuration = 60

/**
 * POST `/api/workflow/input-schema/from-prompt`
 *
 * Body: `{ prompt: string; flavourId: string }`.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ ok: false, error: "Unauthorised" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Body must be an object." }, { status: 400 })
  }

  const rec = body as Record<string, unknown>
  const prompt = typeof rec.prompt === "string" ? rec.prompt : ""
  const flavourIdRaw = rec.flavourId

  const flavourId = normaliseWorkflowInputSchemaPromptFlavourCandidate({
    candidate: flavourIdRaw,
  })
  if (flavourId === null) {
    return Response.json({ ok: false, error: "Unknown or missing flavourId." }, { status: 400 })
  }

  const providerOptions = buildRunnerGatewayProviderOptions({
    supabaseUserId: user.id,
    tags: ["workflow_input_schema_prompt", `flavour:${flavourId}`],
  })

  const result = await runWorkflowInputSchemaFromPromptAgent({
    prompt,
    flavourId,
    providerOptions,
  })

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 })
  }

  return Response.json({
    ok: true,
    fields: result.fields,
    ...(result.notes ? { notes: result.notes } : {}),
  })
}
