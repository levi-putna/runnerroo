import type { Page } from "@playwright/test"

/**
 * Fills Ark `PinInput` cells for `EmailOtpPinInput` so React `value` state matches the DOM (the hidden
 * field alone does not drive `PinInput.Root` state, which breaks `verifyOtp` in tests).
 */
export async function fillEmailOtpPinCells({
  page,
  dataTestId,
  code,
}: {
  page: Page
  dataTestId: string
  code: string
}) {
  const wrapper = page.getByTestId(dataTestId)
  const first = wrapper.getByRole("textbox").first()
  await first.click()
  await page.keyboard.type(code.replace(/\s/g, ""), { delay: 15 })
}
