import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { readPasswordFixture } from "./password-fixture"

/**
 * Locates the React Flow viewport used by the workflow editor (see `WorkflowCanvas`).
 */
export function workflowFlowLocator({ page }: { page: Page }): Locator {
  return page.locator(".dailify-workflow-flow")
}

/**
 * Returns a canvas node whose visible text includes the given substring (label match).
 */
export function workflowNodeByVisibleText({
  page,
  text,
}: {
  page: Page
  text: string
}): Locator {
  return workflowFlowLocator({ page }).locator(".react-flow__node").filter({ hasText: text })
}

/**
 * Signs in with the Playwright password fixture (same flow as auth spec A6).
 *
 * @returns The fixture when sign-in succeeded; throws if navigation or shell fails.
 */
export async function signInWithPasswordFixture({ page }: { page: Page }): Promise<{
  email: string
  password: string
}> {
  const fixture = readPasswordFixture()
  if (!fixture) {
    throw new Error("Password fixture missing — ensure global-setup wrote playwright/.e2e-password-user.json")
  }

  await page.goto("/login")
  await page.getByTestId("auth-login-password-email").fill(fixture.email)
  await page.getByTestId("auth-login-password-field").fill(fixture.password)
  await page.getByTestId("auth-login-password-submit").click()

  const pwError = page.getByTestId("auth-login-password-error")
  try {
    await Promise.race([
      page.waitForURL(/\/app\/workflows/, { timeout: 30_000 }),
      pwError.waitFor({ state: "visible", timeout: 30_000 }),
    ])
  } catch {
    throw new Error(
      "Password sign-in did not reach /app/workflows — check fixture user and Supabase (see playwright/global-setup.ts).",
    )
  }
  if (await pwError.isVisible().catch(() => false)) {
    const msg = (await pwError.textContent())?.trim() ?? "unknown error"
    throw new Error(`Password sign-in failed: ${msg}`)
  }
  await expect(page.getByTestId("auth-app-shell")).toBeVisible({ timeout: 20_000 })
  return fixture
}

/**
 * Parses the first `runId` from an SSE-style response body returned by `POST /api/workflows/:id/run`.
 *
 * @returns Persisted run UUID when a `kind: "run"` event is present; otherwise `null`.
 */
export function extractRunIdFromWorkflowRunSseBody({ body }: { body: string }): string | null {
  for (const block of body.split(/\n\n+/)) {
    const line = block.split("\n").find((l) => l.startsWith("data: "))
    if (!line) continue
    const jsonPart = line.slice("data: ".length).trim()
    try {
      const payload = JSON.parse(jsonPart) as Record<string, unknown>
      if (payload.kind === "run" && typeof payload.runId === "string" && payload.runId.trim()) {
        return payload.runId.trim()
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Drags the bottom (source) handle of `fromNode` to the top (target) handle of `toNode`
 * (standard invoke → step → end wiring in this graph).
 */
export async function connectSourceBottomToTargetTop({
  fromNode,
  toNode,
}: {
  fromNode: Locator
  toNode: Locator
}): Promise<void> {
  const sourceHandle = fromNode.locator(".react-flow__handle-bottom").first()
  const targetHandle = toNode.locator(".react-flow__handle-top").first()
  await sourceHandle.scrollIntoViewIfNeeded()
  await targetHandle.scrollIntoViewIfNeeded()
  await sourceHandle.dragTo(targetHandle, { force: true })
}

/**
 * Opens the add-step sheet, searches, and picks a catalogue row by its primary label (`p.text-sm.font-medium`).
 */
export async function addWorkflowStepByLabel({
  page,
  label,
  search,
}: {
  page: Page
  /** Row title in the add-step sheet (e.g. `Random number`). */
  label: string
  /** Text typed into the sheet search field (can match label). */
  search: string
}): Promise<void> {
  await page.getByRole("button", { name: "Add step" }).click()
  /** Base UI sheet popup — use `data-slot` because the surface is not always exposed as `role="dialog"`. */
  const sheet = page.locator('[data-slot="sheet-content"]').filter({
    has: page.getByRole("heading", { name: "Add step" }),
  })
  await expect(sheet).toBeVisible({ timeout: 10_000 })
  const searchInput = sheet.getByPlaceholder(/Search steps/i)
  await searchInput.fill("")
  await searchInput.fill(search)
  const row = sheet.getByRole("button").filter({
    has: page.locator("p.text-sm.font-medium", { hasText: label, exact: true }),
  })
  await row.first().click()
  await expect(page.getByRole("heading", { name: "Add step" })).toHaveCount(0, { timeout: 10_000 })
}

/**
 * Sets the workflow title from the editor toolbar (clicks the name control, types, commits with Enter).
 */
export async function setWorkflowEditorName({
  page,
  name,
}: {
  page: Page
  name: string
}): Promise<void> {
  await page.getByRole("button", { name: "Untitled workflow" }).click()
  const nameInput = page.locator("input.text-sm.font-medium.min-w-0.w-48")
  await expect(nameInput).toBeVisible({ timeout: 5_000 })
  await nameInput.fill(name)
  await nameInput.press("Enter")
}
