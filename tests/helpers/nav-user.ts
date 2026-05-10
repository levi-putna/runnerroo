import { expect, type Page } from "@playwright/test"

/**
 * Opens the sidebar user menu and signs out (prefers `data-testid` over `menuitem` roles, which vary with Radix builds).
 */
export async function clickNavUserLogOut({ page }: { page: Page }) {
  const trigger = page.getByTestId("nav-user-menu-trigger")
  const logOut = page.getByTestId("nav-user-log-out")
  await trigger.scrollIntoViewIfNeeded()
  if (!(await trigger.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /toggle sidebar/i }).click()
    await expect(trigger).toBeVisible({ timeout: 10_000 })
  }
  await trigger.click({ timeout: 20_000 })
  await logOut.waitFor({ state: "visible", timeout: 20_000 })
  await logOut.scrollIntoViewIfNeeded()
  await logOut.click({ timeout: 20_000 })
}

/**
 * Asserts sidebar footer account row and dropdown header show the same name and email as the active session.
 */
export async function expectNavMatchesSession({
  page,
  expectedName,
  expectedEmail,
}: {
  page: Page
  expectedName: string
  expectedEmail: string
}) {
  await page.goto("/app/workflows")
  await expect(page.getByTestId("nav-user-footer-name")).toHaveText(expectedName)
  await expect(page.getByTestId("nav-user-footer-email")).toHaveText(expectedEmail)
  await page.getByTestId("nav-user-menu-trigger").click()
  await expect(page.getByTestId("nav-user-menu-name")).toHaveText(expectedName)
  await expect(page.getByTestId("nav-user-menu-email")).toHaveText(expectedEmail)
  await page.keyboard.press("Escape")
}
