"use client"

import { UserRound } from "lucide-react"
import { SettingsSectionPanel } from "@/components/settings/settings-section-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ProfilePersonalInfoSectionProps = {
  defaultName: string
  defaultEmail: string
}

/**
 * Personal name/email fields in the shared settings panel shell. Client-only so the Lucide icon can be passed safely.
 */
export function ProfilePersonalInfoSection({ defaultName, defaultEmail }: ProfilePersonalInfoSectionProps) {
  return (
    <SettingsSectionPanel
      icon={UserRound}
      title="Personal information"
      subtitle="Update your name. Your email is shown for reference only."
      footerHint="Your email is tied to your sign-in and cannot be edited on this screen."
      footerActions={<Button>Save changes</Button>}
    >
      {/* Fields */}
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input defaultValue={defaultName} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input defaultValue={defaultEmail} disabled />
        </div>
      </div>
    </SettingsSectionPanel>
  )
}
