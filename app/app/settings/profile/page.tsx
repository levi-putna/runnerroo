import { ProfileAvatarForm } from "@/components/settings/profile-avatar-form"
import { ProfilePasswordForm } from "@/components/settings/profile-password-form"
import { ProfilePersonalInfoSection } from "@/components/settings/profile-personal-info-section"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"

/**
 * Profile settings: personal details (read-only email), password, and avatar.
 */
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name = user?.user_metadata?.full_name ?? ""
  const email = user?.email ?? ""
  const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const identityProviders = user?.identities?.map(({ provider }) => provider) ?? []

  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" description="Manage your account settings" />

      <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
        <ProfilePersonalInfoSection defaultName={name} defaultEmail={email} />

        {user ? <ProfilePasswordForm email={email} identityProviders={identityProviders} /> : null}

        {user ? <ProfileAvatarForm email={email} userMetadata={userMetadata} /> : null}
      </div>
    </div>
  )
}
