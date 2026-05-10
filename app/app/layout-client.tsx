"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
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
}: {
  children: React.ReactNode
  user: User
  recentSidebarEntries: SidebarRecentEntry[]
  pendingApprovalCount?: number
}) {
  return (
    <SidebarProvider className="h-full overflow-hidden">
      <AppSidebar
        pendingApprovalCount={pendingApprovalCount}
        recentSidebarEntries={recentSidebarEntries}
        user={user}
      />

      {/* SidebarInset is the <main> element — no extra wrapper needed */}
      <SidebarInset className="overflow-y-auto">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
