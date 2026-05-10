import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function applyEnvFile({ path, overwrite = false }: { path: string; overwrite?: boolean }) {
  const full = resolve(process.cwd(), path)
  if (!existsSync(full)) return
  for (const rawLine of readFileSync(full, "utf8").split("\n")) {
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

const fixturePath = resolve(process.cwd(), "playwright", ".e2e-password-user.json")

/**
 * Removes any auth user whose primary email matches `email` (paginates until exhausted).
 */
async function deleteAuthUserByEmailIfPresent({
  admin,
  email,
}: {
  admin: SupabaseClient
  email: string
}) {
  const target = email.trim().toLowerCase()
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.warn("[playwright global-setup] listUsers failed:", error.message)
      return
    }
    const batch = data.users ?? []
    const match = batch.find((u) => (u.email ?? "").toLowerCase() === target)
    if (match?.id) {
      const { error: delErr } = await admin.auth.admin.deleteUser(match.id)
      if (delErr) {
        console.warn("[playwright global-setup] deleteUser failed:", delErr.message)
      }
      return
    }
    if (batch.length < perPage) break
    page += 1
  }
}

/**
 * Seeds a confirmed password user for A6 when service role credentials exist.
 * Uses a stable mailbox so re-runs after `supabase db reset` do not leave a stale `playwright/.e2e-password-user.json`.
 */
export default async function globalSetup() {
  applyEnvFile({ path: ".env.local" })
  applyEnvFile({ path: ".env.playwright.local", overwrite: true })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    if (existsSync(fixturePath)) {
      try {
        unlinkSync(fixturePath)
      } catch {
        /* ignore */
      }
    }
    return
  }

  const email = (
    process.env.E2E_PASSWORD_USER_EMAIL ?? "e2e-playwright-password@e2e.example.test"
  ).trim().toLowerCase()
  const password = `E2ePw!${randomUUID().replace(/-/g, "").slice(0, 16)}`

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await deleteAuthUserByEmailIfPresent({ admin, email })

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    console.warn("[playwright global-setup] admin.createUser failed:", error.message)
    try {
      if (existsSync(fixturePath)) unlinkSync(fixturePath)
    } catch {
      /* ignore */
    }
    return
  }

  const dir = resolve(process.cwd(), "playwright")
  mkdirSync(dir, { recursive: true })
  writeFileSync(fixturePath, JSON.stringify({ email, password }, null, 2), "utf8")
  console.info(
    "[playwright global-setup] Seeded password E2E user. If auth specs fail oddly, restart `yarn dev` so the browser bundle picks up current NEXT_PUBLIC_SUPABASE_* keys."
  )
}
