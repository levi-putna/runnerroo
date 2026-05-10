import { expect, test } from "@playwright/test"
import {
  deleteAllMailpitMessages,
  extractEmailOtpFromMailpitHtml,
  fetchMailpitMessageHtml,
  waitForMessageToRecipient,
} from "../helpers/mailpit"
import { createEphemeralAuthIdentity, randomSuffix } from "../helpers/test-identity"
import { clickNavUserLogOut, expectNavMatchesSession } from "../helpers/nav-user"
import { isLocalSupabaseUrlConfigured, isMailpitReachable } from "../helpers/local-stack"
import { expectSignupOtpStepOrRejectDetailsError } from "../helpers/signup-assert"
import { fillEmailOtpPinCells } from "../helpers/email-otp-playwright"

test.describe.configure({ mode: "serial" })

test.describe("@profile-secondary Profile settings", () => {
  test.beforeAll(async () => {
    if (!isLocalSupabaseUrlConfigured()) {
      test.skip(true, "Set NEXT_PUBLIC_SUPABASE_URL to local Supabase for profile E2E")
    }
    if (!(await isMailpitReachable())) {
      test.skip(true, "Mailpit not reachable — start local Supabase (`yarn sb:start`)")
    }
  })

  test.beforeEach(async ({ page }) => {
    await deleteAllMailpitMessages()
    const { email, fullName } = createEphemeralAuthIdentity({ parallelIndex: 2 })
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

  test("U2 email is read-only and matches nav", async ({ page }) => {
    await page.goto("/app/settings/profile")
    const emailValue = await page.getByTestId("profile-email-input").inputValue()
    expect(emailValue.length).toBeGreaterThan(3)
    await expect(page.getByTestId("profile-email-input")).toBeDisabled()
    await expectNavMatchesSession({
      page,
      expectedName: (await page.getByTestId("profile-full-name-input").inputValue()) || "User",
      expectedEmail: emailValue,
    })
  })

  test("U1 updates display name and nav matches", async ({ page }) => {
    await page.goto("/app/settings/profile")
    const emailValue = await page.getByTestId("profile-email-input").inputValue()
    const newName = `Renamed ${randomSuffix()}`
    await page.getByTestId("profile-full-name-input").fill(newName)
    await page.getByTestId("profile-personal-save").click()
    await expect(page.getByTestId("profile-personal-message")).toContainText("updated", {
      ignoreCase: true,
    })
    await page.reload()
    await expect(page.getByTestId("profile-full-name-input")).toHaveValue(newName)
    await expectNavMatchesSession({ page, expectedName: newName, expectedEmail: emailValue })
  })

  test("U3 sets first password then signs in again", async ({ page }) => {
    await page.goto("/app/settings/profile")
    const emailValue = await page.getByTestId("profile-email-input").inputValue()
    const newPw = `E2eNew!${randomSuffix()}aa`
    await page.getByTestId("profile-new-password").fill(newPw)
    await page.getByTestId("profile-confirm-password").fill(newPw)
    await page.getByTestId("profile-password-submit").click()
    await expect(page.getByTestId("profile-password-message")).toContainText("updated", {
      ignoreCase: true,
      timeout: 20_000,
    })

    await clickNavUserLogOut({ page })
    await page.waitForURL("**/login**")

    await page.goto("/login")
    await page.getByTestId("auth-login-password-email").fill(emailValue)
    await page.getByTestId("auth-login-password-field").fill(newPw)
    await page.getByTestId("auth-login-password-submit").click()
    await expect(page.getByTestId("auth-app-shell")).toBeVisible({ timeout: 30_000 })
  })

  test("U4 reauthentication path when enforced by GoTrue", async ({ page }) => {
    await page.goto("/app/settings/profile")
    const newPw = `E2eReauth!${randomSuffix()}bb`
    await page.getByTestId("profile-new-password").fill(newPw)
    await page.getByTestId("profile-confirm-password").fill(newPw)
    await page.getByTestId("profile-password-submit").click()
    const sendReauth = page.getByTestId("profile-password-send-reauth")
    if (!(await sendReauth.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, "Local GoTrue did not require reauthentication for this password change")
    }
    const emailValue = await page.getByTestId("profile-email-input").inputValue()
    await sendReauth.click()
    await expect(page.getByTestId("profile-password-message")).toBeVisible()
    const msgId = await waitForMessageToRecipient({ email: emailValue })
    const html = await fetchMailpitMessageHtml({ id: msgId })
    const otp = extractEmailOtpFromMailpitHtml({ html })
    await fillEmailOtpPinCells({ page, dataTestId: "profile-password-reauth-otp", code: otp })
    await page.getByTestId("profile-password-confirm-reauth").click()
    await expect(page.getByTestId("profile-password-message")).toContainText("updated", {
      ignoreCase: true,
      timeout: 20_000,
    })
  })

  test("U5 and U6 avatar customise then reset", async ({ page }) => {
    await page.goto("/app/settings/profile")
    await page.getByTestId("profile-avatar-customise-switch").click()
    await page.getByTestId("profile-avatar-style").click()
    await page.getByRole("option", { name: /fun emoji/i }).click()
    await page.getByTestId("profile-avatar-save").click()
    await expect(page.getByTestId("profile-avatar-message")).toContainText("saved", { ignoreCase: true })
    const previewSrc = await page.locator('[data-testid="profile-avatar-preview"] img').getAttribute("src")
    expect(previewSrc).toBeTruthy()

    await page.getByTestId("profile-avatar-customise-switch").click()
    await expect(page.getByTestId("profile-avatar-message")).toContainText("default", { ignoreCase: true })
  })
})
