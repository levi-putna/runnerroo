/**
 * Whether Playwright should run Mailpit-backed specs (local Supabase + Mailpit only).
 */
export function isLocalSupabaseUrlConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url.trim())
}

/**
 * Whether Mailpit HTTP API responds (Inbucket port from `supabase/config.toml`).
 */
export async function isMailpitReachable() {
  const base = (
    process.env.MAILPIT_BASE_URL ?? process.env.NEXT_PUBLIC_MAILPIT_URL ?? "http://127.0.0.1:54324"
  ).replace(/\/$/, "")
  try {
    const res = await fetch(`${base}/api/v1/messages?limit=1`)
    return res.ok
  } catch {
    return false
  }
}
