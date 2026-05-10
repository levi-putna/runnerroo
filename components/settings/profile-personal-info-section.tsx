"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserRound } from "lucide-react"
import { SettingsSectionPanel } from "@/components/settings/settings-section-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

type ProfilePersonalInfoSectionProps = {
  defaultName: string
  defaultEmail: string
}

/**
 * Personal name/email fields in the shared settings panel shell. Client-only so the Lucide icon can be passed safely.
 */
export function ProfilePersonalInfoSection({ defaultName, defaultEmail }: ProfilePersonalInfoSectionProps) {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState(defaultName)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  /**
   * Persists display name to Supabase `user_metadata.full_name` and refreshes server components.
   */
  async function handleSave() {
    setMessage(null)
    const trimmed = fullName.trim()
    if (!trimmed) {
      setMessage({ tone: "error", text: "Please enter your full name." })
      return
    }
    const { error } = await supabase.auth.updateUser({
      data: { full_name: trimmed },
    })
    if (error) {
      setMessage({ tone: "error", text: error.message })
      return
    }
    setMessage({ tone: "success", text: "Your name was updated." })
    startTransition(() => router.refresh())
  }

  return (
    <SettingsSectionPanel
      dataTestId="profile-personal-section"
      icon={UserRound}
      title="Personal information"
      subtitle="Update your name. Your email is shown for reference only."
      footerHint="Your email is tied to your sign-in and cannot be edited on this screen."
      footerActions={
        <Button
          type="button"
          disabled={pending}
          onClick={() => void handleSave()}
          data-testid="profile-personal-save"
        >
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      }
    >
      {/* Fields */}
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-full-name">Full name</Label>
          <Input
            id="profile-full-name"
            data-testid="profile-full-name-input"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              if (message) setMessage(null)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email-readonly">Email</Label>
          <Input
            id="profile-email-readonly"
            data-testid="profile-email-input"
            value={defaultEmail}
            readOnly
            disabled
          />
        </div>
        {message ? (
          <p
            className={
              message.tone === "success"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-sm text-destructive"
            }
            role="status"
            data-testid="profile-personal-message"
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </SettingsSectionPanel>
  )
}
