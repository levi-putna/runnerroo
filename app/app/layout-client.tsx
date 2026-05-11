"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { usePendingApprovalsRealtime } from "@/hooks/use-pending-approvals-realtime"
import type { SidebarRecentEntry } from "@/lib/app/sidebar-recent-entries"

interface User {
  name: string
  email: string
  avatar: string
}

/**
 * Client shell for the authenticated app layout.
 *
 * `SidebarProvider` receives `h-full` so it resolves to the definite `h-dvh`
 * set by the server `AppLayout` wrapper — giving the entire height chain a
 * concrete size. `AppSidebar` and `SidebarInset` are direct children of
 * `SidebarProvider` as the shadcn sidebar layout requires.
 *
 * `SidebarInset` uses `overflow-y-auto` so regular content pages scroll
 * naturally within the inset. Full-height pages (e.g. chat) use `min-h-full`
 * on their outermost div to fill the viewport instead of scrolling.
 */
export function AppLayoutClient({
  children,
  user,
  recentSidebarEntries,
  pendingApprovalCount = 0,
  userId,
}: {
  children: React.ReactNode
  user: User
  recentSidebarEntries: SidebarRecentEntry[]
  pendingApprovalCount?: number
  userId: string
}) {
  const { pendingCount } = usePendingApprovalsRealtime({
    userId,
    initialCount: pendingApprovalCount,
  })

  return (
    <SidebarProvider className="h-full overflow-hidden">
      {/* Navigation rail — badge count reflects Realtime approval updates */}
      <AppSidebar
        pendingApprovalCount={pendingCount}
        recentSidebarEntries={recentSidebarEntries}
        user={user}
      />

      {/* Main scroll region for authenticated routes */}
      <SidebarInset className="overflow-y-auto">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
