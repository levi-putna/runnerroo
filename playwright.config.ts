import { defineConfig, devices } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Loads KEY=VALUE lines into `process.env`. When `overwrite` is false, existing keys are left unchanged.
 */
function applyEnvFile({ path, overwrite = false }: { path: string; overwrite?: boolean }) {
  const fullPath = resolve(process.cwd(), path)
  if (!existsSync(fullPath)) return
  for (const rawLine of readFileSync(fullPath, "utf8").split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (overwrite || process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

applyEnvFile({ path: ".env.local" })
applyEnvFile({ path: ".env.playwright.local", overwrite: true })

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:80"

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./playwright/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "yarn dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
