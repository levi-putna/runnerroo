"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AUTH_EMAIL_OTP_LENGTH, EmailOtpPinInput } from "@/components/auth/email-otp-pin-input"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { GitBranch, KeyRound, Loader2, Mail } from "lucide-react"

const DEV_MAILPIT_URL = process.env.NEXT_PUBLIC_MAILPIT_URL ?? ""

/**
 * Sends a one-time sign-in code to the given email (does not create new users).
 */
async function sendSignInOtp({
  email,
  emailRedirectTo,
}: {
  email: string
  emailRedirectTo: string
}) {
  const supabase = createClient()
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  })
}

/**
 * Completes email passwordless sign-in using the 6-digit code from the user&apos;s inbox.
 */
async function verifySignInOtp({
  email,
  token,
}: {
  email: string
  token: string
}) {
  const supabase = createClient()
  return supabase.auth.verifyOtp({
    email,
    token: token.replace(/\s/g, ""),
    type: "email",
  })
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [step, setStep] = useState<"email" | "code">("email")
  const [sendLoading, setSendLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  /**
   * OAuth sign-in redirects through the PKCE handler route.
   */
  async function handleOAuth({ provider }: { provider: "google" | "github" | "apple" }) {
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthErr) setError(oauthErr.message)
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setSendLoading(true)
    setError(null)
    const { error: otpErr } = await sendSignInOtp({
      email,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    })
    if (otpErr) {
      setError(otpErr.message)
    } else {
      setStep("code")
    }
    setSendLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setVerifyLoading(true)
    setError(null)
    const { error: verifyErr } = await verifySignInOtp({ email, token: otpCode })
    if (verifyErr) {
      setError(verifyErr.message)
    } else {
      router.push("/workflows")
      router.refresh()
    }
    setVerifyLoading(false)
  }

  async function handleResendCode() {
    setSendLoading(true)
    setError(null)
    const { error: otpErr } = await sendSignInOtp({
      email,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    })
    if (otpErr) setError(otpErr.message)
    setSendLoading(false)
  }

  if (step === "code") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <CardTitle>Enter your code</CardTitle>
          <CardDescription>
            We emailed a sign-in PIN to <strong>{email}</strong>. Enter it below to finish signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mailpit quick link (local dev) */}
          {DEV_MAILPIT_URL ? (
            <p className="text-center text-xs text-muted-foreground">
              Local testing:{" "}
              <a href={DEV_MAILPIT_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Open Mailpit
              </a>
            </p>
          ) : null}
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <EmailOtpPinInput
              label="6-digit code"
              value={otpCode}
              required
              invalid={Boolean(error)}
              count={AUTH_EMAIL_OTP_LENGTH}
              onValueChange={({ valueAsString }) => {
                setOtpCode(valueAsString)
                if (error) setError(null)
              }}
              className="w-full"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={verifyLoading}>
              {verifyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm and sign in
            </Button>
          </form>
          <Button type="button" variant="outline" className="w-full" disabled={sendLoading} onClick={handleResendCode}>
            {sendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resend code
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <Button
            variant="ghost"
            onClick={() => {
              setStep("email")
              setOtpCode("")
              setError(null)
            }}
          >
            Use a different email
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Welcome back</CardTitle>
        <CardDescription>Sign in with a one-time email code or a connected account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Social auth */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => handleOAuth({ provider: "google" })} type="button">
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>
          <Button variant="outline" onClick={() => handleOAuth({ provider: "github" })} type="button">
            <GitBranch className="h-4 w-4" />
            GitHub
          </Button>
          <Button variant="outline" onClick={() => handleOAuth({ provider: "apple" })} type="button">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
            </svg>
            Apple
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or email code</span>
          </div>
        </div>

        {/* Email PIN step */}
        <form onSubmit={handleSendCode} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          {DEV_MAILPIT_URL ? (
            <p className="text-xs text-muted-foreground">
              Local dev — auth emails arrive in{" "}
              <a href={DEV_MAILPIT_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Mailpit
              </a>
              .
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={sendLoading}>
            {sendLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Send sign-in PIN
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
