import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export type E2EPasswordFixture = {
  email: string
  password: string
}

/**
 * Reads credentials written by `playwright/global-setup.ts` when the service role key is available.
 */
export function readPasswordFixture(): E2EPasswordFixture | null {
  const path = resolve(process.cwd(), "playwright", ".e2e-password-user.json")
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8")) as E2EPasswordFixture
}
