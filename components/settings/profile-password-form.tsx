"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AUTH_EMAIL_OTP_LENGTH, EmailOtpPinInput } from "@/components/auth/email-otp-pin-input"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { SettingsSectionPanel } from "@/components/settings/settings-section-panel"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Loader2 } from "lucide-react"

/** Matches local Supabase `minimum_password_length` default; keep aligned with hosted project settings. */
const MIN_PASSWORD_LENGTH = 6

const OAUTH_PROVIDERS = new Set(["google", "github", "apple"])

type ProfilePasswordFormProps = {
  email: string
  /** `user.identities[].provider` values from the server session (serialisable). */
  identityProviders: string[]
}

/**
 * Detects GoTrue errors where password updates need an email/phone nonce (secure password change).
 */
function isReauthenticationRequiredError({ message }: { message: string }): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("reauthentication") ||
    m.includes("reauthenticate") ||
    m.includes("session not recent") ||
    m.includes("requires a nonce") ||
    m.includes("missing nonce")
  )
}

/**
 * Settings card: set or change the account password via `updateUser`, with optional current-password
 * verification and Supabase reauthentication when the project enables secure password changes.
 */
export function ProfilePasswordForm({ email, identityProviders }: ProfilePasswordFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [reauthNonce, setReauthNonce] = useState("")
  const [reauthStepActive, setReauthStepActive] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [pendingNewPassword, setPendingNewPassword] = useState<string | null>(null)

  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  const oauthProvidersPresent = identityProviders.filter((p) => OAUTH_PROVIDERS.has(p))
  const oauthList =
    oauthProvidersPresent.length > 0
      ? oauthProvidersPresent.map((p) => p.replace(/^./, (c) => c.toUpperCase())).join(", ")
      : null

  async function verifyCurrentPasswordIfProvided(): Promise<boolean> {
    const trimmed = currentPassword.trim()
    if (!trimmed) return true
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: trimmed,
    })
    if (error) {
      setMessage({
        tone: "error",
        text: "Current password is incorrect, or this account does not use a password sign-in yet.",
      })
      return false
    }
    return true
  }

  async function attemptPasswordUpdate({
    password,
    nonce,
  }: {
    password: string
    nonce?: string
  }): Promise<{ ok: boolean; needsReauth: boolean }> {
    const { error } = await supabase.auth.updateUser({
      ...(nonce ? { password, nonce } : { password }),
    })
    if (!error) {
      return { ok: true, needsReauth: false }
    }
    if (isReauthenticationRequiredError({ message: error.message })) {
      return { ok: false, needsReauth: true }
    }
    setMessage({ tone: "error", text: error.message })
    return { ok: false, needsReauth: false }
  }

  async function handleSendReauthCode() {
    setMessage(null)
    setSubmitting(true)
    const { error } = await supabase.auth.reauthenticate()
    setSubmitting(false)
    if (error) {
      setMessage({ tone: "error", text: error.message })
      return
    }
    setCodeSent(true)
    setMessage({
      tone: "success",
      text: "Check your email for a verification code, then enter it below.",
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (reauthStepActive && pendingNewPassword) {
      const code = reauthNonce.replace(/\s/g, "")
      if (code.length < AUTH_EMAIL_OTP_LENGTH) {
        setMessage({ tone: "error", text: `Enter the full ${AUTH_EMAIL_OTP_LENGTH}-digit code from your email.` })
        return
      }
      setSubmitting(true)
      const { ok } = await attemptPasswordUpdate({ password: pendingNewPassword, nonce: code })
      setSubmitting(false)
      if (!ok) return
      setMessage({ tone: "success", text: "Your password was updated." })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setReauthNonce("")
      setReauthStepActive(false)
      setCodeSent(false)
      setPendingNewPassword(null)
      startTransition(() => router.refresh())
      return
    }

    setMessage(null)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        tone: "error",
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: "error", text: "New password and confirmation do not match." })
      return
    }

    setSubmitting(true)
    const verified = await verifyCurrentPasswordIfProvided()
    if (!verified) {
      setSubmitting(false)
      return
    }

    const result = await attemptPasswordUpdate({ password: newPassword })
    setSubmitting(false)
    if (result.ok) {
      setMessage({ tone: "success", text: "Your password was updated." })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      startTransition(() => router.refresh())
      return
    }

    if (result.needsReauth) {
      setPendingNewPassword(newPassword)
      setReauthStepActive(true)
      setReauthNonce("")
      setCodeSent(false)
      setMessage({
        tone: "success",
        text: "For security, confirm this change with a one-time code. Tap Send verification code below.",
      })
    }
  }

  return (
    <SettingsSectionPanel
      id="password"
      dataTestId="profile-password-section"
      icon={KeyRound}
      title="Password"
      subtitle={
        oauthList ? (
          <>
            You also use {oauthList} to sign in. You can add or update an email and password so you can sign in that
            way as well. If you never chose a password (for example you use magic link only), leave the current
            password field blank and set a new one here.
          </>
        ) : (
          <>
            Set a new password for this account. If you do not use a password today (magic link or social sign-in
            only), leave the current password field blank.
          </>
        )
      }
      footerHint={
        reauthStepActive
          ? "We email a short code to verify it is you before the new password is applied."
          : "Use a strong password that you do not reuse on other sites."
      }
      footerActions={
        reauthStepActive ? (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setReauthStepActive(false)
                setPendingNewPassword(null)
                setReauthNonce("")
                setCodeSent(false)
                setMessage(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => void handleSendReauthCode()}
              data-testid="profile-password-send-reauth"
            >
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Send verification code
            </Button>
            <Button
              type="submit"
              form="profile-password-form"
              disabled={submitting || !codeSent}
              data-testid="profile-password-confirm-reauth"
            >
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm password update
            </Button>
          </>
        ) : (
          <Button type="submit" form="profile-password-form" disabled={submitting} data-testid="profile-password-submit">
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Update password
          </Button>
        )
      }
    >
      <form
        id="profile-password-form"
        className="space-y-4"
        data-testid="profile-password-form"
        onSubmit={(e) => void handleSubmit(e)}
      >
        {reauthStepActive ? (
          <>
            {/* Reauthentication step — secure password change */}
            <p className="text-sm text-muted-foreground">
              Your project requires a fresh verification before this change. We will email a one-time code to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
            {codeSent ? (
              <EmailOtpPinInput
                label="Verification code"
                value={reauthNonce}
                dataTestId="profile-password-reauth-otp"
                onValueChange={({ valueAsString }) => setReauthNonce(valueAsString)}
              />
            ) : null}
          </>
        ) : (
          <>
            {/* New password fields */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-current-password">Current password</Label>
              <Input
                id="profile-current-password"
                data-testid="profile-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Leave blank if you do not use one yet"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-new-password">New password</Label>
              <Input
                id="profile-new-password"
                data-testid="profile-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-confirm-password">Confirm new password</Label>
              <Input
                id="profile-confirm-password"
                data-testid="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
          </>
        )}

        {message ? (
          <p
            className={
              message.tone === "success"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-sm text-destructive"
            }
            role="status"
            data-testid="profile-password-message"
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </SettingsSectionPanel>
  )
}
