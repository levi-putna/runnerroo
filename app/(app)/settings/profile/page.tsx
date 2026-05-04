import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name = user?.user_metadata?.full_name ?? ""
  const email = user?.email ?? ""
  const avatar = user?.user_metadata?.avatar_url

  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || email[0]?.toUpperCase()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your name and profile picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatar && <AvatarImage src={avatar} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">Change photo</Button>
          </div>
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
    </div>
  )
}
