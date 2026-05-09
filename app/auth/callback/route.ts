import { createClient } from "@/lib/supabase/server"
import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * Auth callback route — handles both PKCE (code) and token-hash flows.
 *
 * PKCE flow:  /auth/callback?code=xxx        → exchangeCodeForSession
 * Token-hash: /auth/callback?token_hash=xxx  → verifyOtp (same as /auth/confirm)
 *
 * Implicit-flow magic links (#access_token=...) are handled client-side by the
 * onAuthStateChange listener on the login/signup pages, so no server handling
 * is needed here for that case.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/app/workflows"

  const supabase = await createClient()

  // PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Token-hash flow (some local Supabase versions use this for magic links)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
