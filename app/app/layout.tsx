import { redirect } from "next/navigation"
import { getResolvedAvatarUrlForAuthUser } from "@/lib/avatar/dicebear"
import { createClient } from "@/lib/supabase/server"
import { countPendingWorkflowApprovalsForUser } from "@/lib/workflows/queries/approval-queries"
import { fetchWorkflowsForUser } from "@/lib/workflows/queries/queries"
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
    avatar: getResolvedAvatarUrlForAuthUser({ user }),
  }

  const [recentWorkflows, pendingApprovalCount] = await Promise.all([
    fetchWorkflowsForUser({ limit: 12 }),
    countPendingWorkflowApprovalsForUser(),
  ])

  return (
    <AppLayoutClient pendingApprovalCount={pendingApprovalCount} recentWorkflows={recentWorkflows} user={userData}>
      {children}
    </AppLayoutClient>
  )
}
