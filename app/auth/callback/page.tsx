"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { type EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Completes OAuth and email-link auth in the browser so PKCE `code_verifier` in local storage can
 * finish `exchangeCodeForSession` (the server `route.ts` cannot read that verifier).
 */
function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState("Finishing sign-in…")

  useEffect(() => {
    void (async () => {
      const code = searchParams.get("code")
      const tokenHash = searchParams.get("token_hash")
      const type = searchParams.get("type") as EmailOtpType | null
      const next = searchParams.get("next") ?? "/app/workflows"
      const supabase = createClient()

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          window.location.assign(`${window.location.origin}${next}`)
          return
        }
        setMessage(error.message)
        router.replace(`/login?error=auth_callback_failed`)
        return
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        if (!error) {
          window.location.assign(`${window.location.origin}${next}`)
          return
        }
        setMessage(error.message)
        router.replace(`/login?error=auth_callback_failed`)
        return
      }

      router.replace("/login?error=auth_callback_missing_params")
    })()
  }, [router, searchParams])

  // Minimal layout while the session exchange runs
  return <div className="p-8 text-center text-sm text-muted-foreground">{message}</div>
}

/**
 * Suspense boundary for `useSearchParams` (required in Next.js App Router client pages).
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}>
      <AuthCallbackContent />
    </Suspense>
  )
}
