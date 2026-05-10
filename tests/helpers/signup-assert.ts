import { type Page } from "@playwright/test"

const RESTART_HINT =
  "Restart `yarn dev` after `supabase stop/start` or any `.env.local` change so `NEXT_PUBLIC_SUPABASE_*` matches `yarn sb:status`."

/**
 * Waits until the sign-up flow reaches the PIN entry step, or throws with the details-step API error.
 */
export async function expectSignupOtpStepOrRejectDetailsError({ page }: { page: Page }) {
  const otpHidden = page.getByTestId("auth-signup-otp-hidden")
  const detailsErr = page.getByTestId("auth-signup-details-error")
  const sendPin = page.getByTestId("auth-signup-send-pin")
  try {
    await Promise.race([
      otpHidden.waitFor({ state: "visible", timeout: 25_000 }),
      detailsErr.waitFor({ state: "visible", timeout: 25_000 }),
    ])
  } catch {
    const sendStillThere = await sendPin.isVisible().catch(() => false)
    throw new Error(
      `Sign-up send PIN did not reach the code step within 25s (send button still visible: ${sendStillThere}). ${RESTART_HINT}`
    )
  }
  if (await detailsErr.isVisible().catch(() => false)) {
    const text = (await detailsErr.textContent())?.trim() ?? "unknown error"
    throw new Error(`Sign-up send PIN failed: ${text}`)
  }
}
