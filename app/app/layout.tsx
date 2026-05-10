import { redirect } from "next/navigation"
import { getResolvedAvatarUrlForAuthUser } from "@/lib/avatar/dicebear"
import { createClient } from "@/lib/supabase/server"
import { countPendingWorkflowApprovalsForUser } from "@/lib/workflows/queries/approval-queries"
import { fetchWorkflowsForUser } from "@/lib/workflows/queries/queries"
import { AppLayoutClient } from "./layout-client"

/**
 * Authenticated product layout — session gate, sidebar shell, and viewport-scoped overflow.
 */
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
    <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden">
      {/* Product shell — full viewport height and clipped overflow live here so the public `(site)` tree can scroll on `body`. */}
      <AppLayoutClient pendingApprovalCount={pendingApprovalCount} recentWorkflows={recentWorkflows} user={userData}>
        {children}
      </AppLayoutClient>
    </div>
  )
}
