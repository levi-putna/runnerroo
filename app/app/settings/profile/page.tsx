import { ProfileAvatarForm } from "@/components/settings/profile-avatar-form"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name = user?.user_metadata?.full_name ?? ""
  const email = user?.email ?? ""
  const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>

  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" description="Manage your account settings" />

      <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>Update your name. Your email is shown for reference only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input defaultValue={name} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input defaultValue={email} disabled />
              </div>
            </div>
            <Button>Save changes</Button>
          </CardContent>
        </Card>

        {user ? <ProfileAvatarForm email={email} userMetadata={userMetadata} /> : null}
      </div>
    </div>
  )
}
