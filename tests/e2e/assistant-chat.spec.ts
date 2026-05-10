import { expect, test } from "@playwright/test"
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models"
import {
  evaluateAssistantReplyAppropriateness,
  hasAiGatewayApiKeyForPlaywright,
  isAssistantLlmJudgeEnabled,
} from "../helpers/assistant-reply-judge"
import { isLocalSupabaseUrlConfigured } from "../helpers/local-stack"
import { readPasswordFixture } from "../helpers/password-fixture"
import { signInWithPasswordFixture } from "../helpers/workflow-playwright"

/**
 * Catalogue id deliberately different from {@link DEFAULT_MODEL_ID} so `POST /api/chat` body can be asserted.
 * Must stay in sync with [`GATEWAY_MODELS`](lib/ai-gateway/models.ts).
 */
const NON_DEFAULT_CHAT_MODEL_ID_FOR_E2E = "xai/grok-4.3" as const

// Credentials: `playwright/global-setup.ts` + `.env.playwright.local`. Chat + judge need `AI_GATEWAY_API_KEY` on the dev server and (for judge) in the Playwright process.

test.describe.serial("@assistant Assistant chat", () => {
  test.beforeEach(() => {
    test.skip(!isLocalSupabaseUrlConfigured(), "Local Supabase URL required (see tests/helpers/local-stack.ts)")
    test.skip(!readPasswordFixture(), "Password fixture missing — global-setup must seed playwright/.e2e-password-user.json")
  })

  test("C1: hello message, assistant reply, optional LLM judge, session usage", async ({ page }) => {
    test.setTimeout(180_000)
    test.skip(
      !hasAiGatewayApiKeyForPlaywright(),
      "Set AI_GATEWAY_API_KEY in .env.playwright.local (judge) and ensure yarn dev has the key for /api/chat",
    )

    await signInWithPasswordFixture({ page })
    await page.goto("/app/chat")
    await expect(page).toHaveURL(/\/app\/chat/)
    await expect(page.getByPlaceholder(/Message Dailify/i)).toBeVisible({ timeout: 20_000 })

    /** Desktop layout usually opens the context panel from localStorage; avoid a global `Show context panel` click (ambiguous with other controls). */
    const usageSection = page.getByRole("region", { name: "Session usage" })
    await expect(usageSection).toBeVisible({ timeout: 15_000 })

    const composer = page.getByLabel("Message", { exact: true })
    await expect(composer).toBeVisible({ timeout: 15_000 })
    const hello = "Hello — this is a Playwright test. Please reply with a brief friendly greeting."
    await composer.fill(hello)
    await composer.press("Enter")

    /** Composer is disabled while `useChat` is `submitted` / `streaming`; this waits for the full assistant reply. */
    await expect(composer).toBeEnabled({ timeout: 90_000 })

    const lastAssistant = page.locator(".is-assistant").last()
    const replyText = (await lastAssistant.innerText()).trim()
    expect(replyText.length).toBeGreaterThan(3)

    if (isAssistantLlmJudgeEnabled()) {
      const verdict = await evaluateAssistantReplyAppropriateness({
        userMessage: hello,
        assistantReply: replyText,
      })
      expect(verdict.appropriate, verdict.reason).toBe(true)
    }

    await expect(usageSection.getByText(/This conversation:/)).toBeVisible({ timeout: 30_000 })
    await expect(usageSection.getByText(/This conversation:.*\d/)).toBeVisible()
    await expect(usageSection.getByText("No usage data yet.")).toHaveCount(0)
  })

  test("C2: selected composer model is sent as modelId on POST /api/chat", async ({ page }) => {
    test.skip(
      DEFAULT_MODEL_ID === NON_DEFAULT_CHAT_MODEL_ID_FOR_E2E,
      "Default model id matches test constant — pick another NON_DEFAULT_CHAT_MODEL_ID_FOR_E2E",
    )

    await page.addInitScript((modelId: string) => {
      window.localStorage.setItem("dailify-selected-chat-model", modelId)
    }, NON_DEFAULT_CHAT_MODEL_ID_FOR_E2E)

    await signInWithPasswordFixture({ page })

    const requestPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/api/chat"),
      { timeout: 120_000 },
    )

    await page.goto("/app/chat")
    await expect(page).toHaveURL(/\/app\/chat/)
    await expect(page.getByPlaceholder(/Message Dailify/i)).toBeVisible({ timeout: 20_000 })

    const composer = page.getByLabel("Message", { exact: true })
    await expect(composer).toBeVisible({ timeout: 15_000 })
    await composer.fill("ping")
    await composer.press("Enter")

    const req = await requestPromise
    const raw = req.postData()
    expect(raw, "POST /api/chat should include JSON body").toBeTruthy()
    const body = JSON.parse(raw!) as { modelId?: string }
    expect(body.modelId).toBe(NON_DEFAULT_CHAT_MODEL_ID_FOR_E2E)
  })
})
