import { expect, test } from "@playwright/test"
import {
  deleteAllMailpitMessages,
  extractEmailOtpFromMailpitHtml,
  extractMagicLinkUrl,
  fetchMailpitMessageHtml,
  waitForMessageToRecipient,
} from "../helpers/mailpit"
import { createEphemeralAuthIdentity } from "../helpers/test-identity"
import { expectSingleUserForEmailOtpIdentity } from "../helpers/supabase-admin"
import { readPasswordFixture } from "../helpers/password-fixture"
import { getAuthUserIdFromBrowserStorage } from "../helpers/browser-session"
import { isLocalSupabaseUrlConfigured, isMailpitReachable } from "../helpers/local-stack"
import { expectSignupOtpStepOrRejectDetailsError } from "../helpers/signup-assert"
import { fillEmailOtpPinCells } from "../helpers/email-otp-playwright"
import { clickNavUserLogOut } from "../helpers/nav-user"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:80"

test.describe("Authentication", () => {
  test("A5: unauthenticated user is sent to login", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto("/app/workflows")
    await expect(page).toHaveURL(/\/login/)
  })

  test("A6: password sign-in with seeded user", async ({ page }) => {
    test.skip(!isLocalSupabaseUrlConfigured(), "Password fixture E2E targets local Supabase only")
    const fixture = readPasswordFixture()
    test.skip(!fixture, "Run with SUPABASE_SERVICE_ROLE_KEY so global-setup seeds playwright/.e2e-password-user.json")

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
        `Password sign-in did not navigate to /app/workflows and no password error appeared. Check fixture user exists (global-setup) and restart \`yarn dev\` after Supabase or .env changes.`
      )
    }
    if (await pwError.isVisible().catch(() => false)) {
      const msg = (await pwError.textContent())?.trim() ?? "unknown error"
      throw new Error(`Password sign-in failed: ${msg}`)
    }
    await expect(page.getByTestId("auth-app-shell")).toBeVisible({ timeout: 20_000 })
  })
})

test.describe("Authentication @mailpit", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    if (!isLocalSupabaseUrlConfigured()) {
      test.skip(true, "Set NEXT_PUBLIC_SUPABASE_URL to http://127.0.0.1:<api-port> (see yarn sb:status)")
    }
    const mailpitUp = await isMailpitReachable()
    if (!mailpitUp) {
      test.skip(true, "Mailpit not reachable — start local Supabase (`yarn sb:start`) and check MAILPIT_BASE_URL")
    }
  })

  test.beforeEach(async () => {
    await deleteAllMailpitMessages()
  })

  test("A1: signup email PIN reaches app shell", async ({ page }) => {
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 0 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    const msgId = await waitForMessageToRecipient({ email })
    const html = await fetchMailpitMessageHtml({ id: msgId })
    const otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: otp })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible({ timeout: 30_000 })
  })

  test("A2: login magic link then OTP", async ({ page }) => {
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 0 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    const msgId = await waitForMessageToRecipient({ email })
    const html = await fetchMailpitMessageHtml({ id: msgId })
    const otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: otp })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible()

    await clickNavUserLogOut({ page })
    await page.waitForURL("**/login**")

    await page.goto("/login")
    await page.getByTestId("auth-login-magic-link").click()
    await page.getByTestId("auth-login-magic-link-email").fill(email)
    await page.getByTestId("auth-send-magic-link").click()
    await page.getByTestId("auth-login-enter-code").click()
    const msg2 = await waitForMessageToRecipient({ email })
    const html2 = await fetchMailpitMessageHtml({ id: msg2 })
    const otp2 = extractEmailOtpFromMailpitHtml({ html: html2 })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-login-otp", code: otp2 })
    await page.getByTestId("auth-login-confirm-otp").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible()
  })

  test("A3: magic link URL completes session", async ({ page }) => {
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 0 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    const msgId = await waitForMessageToRecipient({ email })
    const html = await fetchMailpitMessageHtml({ id: msgId })
    const link = extractMagicLinkUrl({ htmlOrText: html, appOrigin: baseURL })
    test.skip(!link, "No magic link URL found in Mailpit HTML for this template run")
    await page.goto(link!)
    await expect(page.getByTestId("auth-app-shell")).toBeVisible({ timeout: 30_000 })
  })

  test("A4: invalid OTP shows error", async ({ page }) => {
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 0 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    await waitForMessageToRecipient({ email })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: "000000" })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-signup-otp-error")).toBeVisible()
  })

  test("A7: resend PIN still allows verify", async ({ page }) => {
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 0 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    await waitForMessageToRecipient({ email })
    await page.getByTestId("auth-signup-resend").click()
    const msgId = await waitForMessageToRecipient({ email })
    const html = await fetchMailpitMessageHtml({ id: msgId })
    const otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: otp })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible()
  })

  test("A11: duplicate signup OTP does not create a second principal", async ({ page }) => {
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 0 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    let msgId = await waitForMessageToRecipient({ email })
    let html = await fetchMailpitMessageHtml({ id: msgId })
    let otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: otp })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible()
    const firstId = await getAuthUserIdFromBrowserStorage({ page })

    await clickNavUserLogOut({ page })
    await page.waitForURL("**/login**")

    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(`${fullName} II`)
    await page.getByTestId("auth-signup-email").fill(email)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    msgId = await waitForMessageToRecipient({ email })
    html = await fetchMailpitMessageHtml({ id: msgId })
    otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: otp })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible()
    const secondId = await getAuthUserIdFromBrowserStorage({ page })

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await expectSingleUserForEmailOtpIdentity({ email })
    } else {
      expect(firstId, "first session user id").toBeTruthy()
      expect(secondId, "second session user id").toEqual(firstId)
    }
  })

  test("A12: wrong password for a different email is rejected", async ({ page }) => {
    const fixture = readPasswordFixture()
    test.skip(!fixture, "Requires seeded password user from global-setup")

    const { email: emailC, fullName } = createEphemeralAuthIdentity({ parallelIndex: 1 })
    await page.goto("/signup")
    await page.getByTestId("auth-signup-name").fill(fullName)
    await page.getByTestId("auth-signup-email").fill(emailC)
    await page.getByTestId("auth-signup-send-pin").click()
    await expectSignupOtpStepOrRejectDetailsError({ page })
    const msgId = await waitForMessageToRecipient({ email: emailC })
    const html = await fetchMailpitMessageHtml({ id: msgId })
    const otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "auth-signup-otp", code: otp })
    await page.getByTestId("auth-signup-verify").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible()

    await clickNavUserLogOut({ page })
    await page.waitForURL("**/login**")

    await page.goto("/login")
    await page.getByTestId("auth-login-password-email").fill(emailC)
    await page.getByTestId("auth-login-password-field").fill(fixture.password)
    await page.getByTestId("auth-login-password-submit").click()
    await expect(page.getByTestId("auth-login-password-error")).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("@oauth", () => {
  test.fixme("A8 Google OAuth — configure OAuth test app + callback URL", async () => {})
  test.fixme("A9 GitHub OAuth — configure OAuth test app + callback URL", async () => {})
  test.fixme("A10 Apple OAuth — configure OAuth test app + callback URL", async () => {})
})
