import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { isLocalSupabaseUrlConfigured } from "../helpers/local-stack"
import { readPasswordFixture } from "../helpers/password-fixture"
import {
  addWorkflowStepByLabel,
  connectSourceBottomToTargetTop,
  extractRunIdFromWorkflowRunSseBody,
  setWorkflowEditorName,
  signInWithPasswordFixture,
  workflowFlowLocator,
  workflowNodeByVisibleText,
} from "../helpers/workflow-playwright"

/** Persisted editor URL from W1 — serial W2 navigates here (requires global-setup password user). */
let persistedWorkflowEditorUrl = ""

// Credentials and Supabase are seeded via `playwright/global-setup.ts` and `.env.playwright.local` (see auth A6).

test.describe.serial("@workflow Workflow builder and run", () => {
  test.beforeEach(() => {
    test.skip(!isLocalSupabaseUrlConfigured(), "Local Supabase URL required (see tests/helpers/local-stack.ts)")
    test.skip(!readPasswordFixture(), "Password fixture missing — run with SUPABASE_SERVICE_ROLE_KEY so global-setup seeds playwright/.e2e-password-user.json")
  })

  test("W1: create invoke → random → end, save, reload", async ({ page }) => {
    await signInWithPasswordFixture({ page })
    await page.goto("/app/workflows/new")
    await expect(workflowFlowLocator({ page })).toBeVisible({ timeout: 30_000 })

    const workflowName = `E2E workflow ${randomUUID().slice(0, 8)}`
    await setWorkflowEditorName({ page, name: workflowName })

    await addWorkflowStepByLabel({ page, label: "Random number", search: "random" })
    await addWorkflowStepByLabel({ page, label: "End", search: "end" })

    const flow = workflowFlowLocator({ page })
    const entry = workflowNodeByVisibleText({ page, text: "Invoke workflow" })
    const random = workflowNodeByVisibleText({ page, text: "Random number" })
    /** End step is icon-only on the canvas — match its `aria-label` from `EndNode`. */
    const end = flow.locator(".react-flow__node").filter({
      has: page.locator("[aria-label='End, end of workflow']"),
    })

    await expect(entry).toBeVisible({ timeout: 15_000 })
    await expect(random).toBeVisible({ timeout: 15_000 })
    await expect(end).toBeVisible({ timeout: 15_000 })

    await connectSourceBottomToTargetTop({ fromNode: entry, toNode: random })
    await connectSourceBottomToTargetTop({ fromNode: random, toNode: end })

    await expect(flow.locator(".react-flow__edge")).toHaveCount(2, { timeout: 20_000 })

    const createWorkflowResponse = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/workflows",
      { timeout: 45_000 },
    )
    await page.getByRole("button", { name: "Save" }).click()
    const saveResponse = await createWorkflowResponse
    const saveBody = (await saveResponse.json()) as { workflow?: { id: string }; error?: string }
    expect(saveResponse.ok(), saveBody.error ?? (await saveResponse.text())).toBeTruthy()
    expect(saveBody.workflow?.id, "Create workflow response should include workflow.id").toBeTruthy()
    const workflowId = saveBody.workflow!.id
    /** Soft navigation after save — poll URL rather than waiting for a full document `load`. */
    await expect(page).toHaveURL(new RegExp(`/app/workflows/${workflowId}(?:$|[?#])`), { timeout: 30_000 })
    persistedWorkflowEditorUrl = page.url()

    await page.reload()
    await expect(workflowFlowLocator({ page })).toBeVisible({ timeout: 30_000 })
    await expect(workflowNodeByVisibleText({ page, text: "Invoke workflow" })).toBeVisible()
    await expect(workflowNodeByVisibleText({ page, text: "Random number" })).toBeVisible()
    await expect(
      flow.locator(".react-flow__node").filter({
        has: page.locator("[aria-label='End, end of workflow']"),
      }),
    ).toBeVisible()
    await expect(flow.locator(".react-flow__edge")).toHaveCount(2, { timeout: 20_000 })
  })

  test("W2: run workflow, open run detail, assert timeline steps", async ({ page }) => {
    test.skip(!persistedWorkflowEditorUrl, "W1 must run first in this serial suite")

    await signInWithPasswordFixture({ page })
    await page.goto(persistedWorkflowEditorUrl)
    await expect(workflowFlowLocator({ page })).toBeVisible({ timeout: 30_000 })

    const responsePromise = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        /\/api\/workflows\/[0-9a-f-]{36}\/run(?:$|\?)/.test(new URL(r.url()).pathname),
      { timeout: 60_000 },
    )

    await page.getByRole("button", { name: "More workflow actions" }).click()
    await page.getByRole("menuitem", { name: "Run" }).click()

    const runDialog = page.locator('[data-slot="dialog-content"]').filter({
      has: page.getByRole("heading", { name: "Run workflow" }),
    })
    await expect(runDialog).toBeVisible({ timeout: 10_000 })
    await runDialog.getByRole("button", { name: "Run", exact: true }).click()

    const runResponse = await responsePromise
    expect(runResponse.ok(), `Run API failed: ${runResponse.status()}`).toBeTruthy()
    const sseBody = await runResponse.text()
    const runId = extractRunIdFromWorkflowRunSseBody({ body: sseBody })
    expect(runId, "Expected SSE payload with kind run and runId").toBeTruthy()

    await page.goto(`/app/run/${runId}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 })

    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible({ timeout: 60_000 })
    /** Timeline labels come from {@link resolveRunStepTimelineLabel} (invoke + random expose friendly copy). */
    await expect(page.getByRole("button", { name: /entry_output \(Invoke workflow\)/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /random \(Random number\)/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /^end-\d+/ })).toBeVisible()
  })
})
