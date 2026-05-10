import { createClient } from "@supabase/supabase-js"

/**
 * Returns a Supabase admin client when service role credentials exist (Playwright global setup / Node-only checks).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Counts auth users whose primary email matches (case-insensitive). Paginates `listUsers` until exhausted.
 */
export async function countUsersWithEmail({ email }: { email: string }) {
  const admin = createSupabaseAdminClient()
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for admin probes")
  }
  const target = email.trim().toLowerCase()
  let page = 1
  const perPage = 200
  let totalMatches = 0
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data.users ?? []
    for (const u of batch) {
      if ((u.email ?? "").toLowerCase() === target) totalMatches += 1
    }
    if (batch.length < perPage) break
    page += 1
  }
  return totalMatches
}

/**
 * Asserts GoTrue never created a second principal for the same mailbox (duplicate OTP signup guard).
 */
export async function expectSingleUserForEmailOtpIdentity({ email }: { email: string }) {
  const n = await countUsersWithEmail({ email })
  if (n !== 1) {
    throw new Error(`Expected exactly one auth user for ${email}, found ${n}`)
  }
}
