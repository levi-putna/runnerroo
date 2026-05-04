import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { fetchWorkflowsForUser } from "@/lib/workflows/queries"
import { AppLayoutClient } from "./layout-client"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const userData = {
    name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
    email: user.email ?? "",
    avatar: user.user_metadata?.avatar_url,
  }

  const recentWorkflows = await fetchWorkflowsForUser({ limit: 12 })

  return (
    <AppLayoutClient recentWorkflows={recentWorkflows} user={userData}>
      {children}
    </AppLayoutClient>
  )
}
