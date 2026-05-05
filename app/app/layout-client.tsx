"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import type { WorkflowListRow } from "@/lib/workflows/queries/queries"

interface User {
  name: string
  email: string
  avatar: string
}

export function AppLayoutClient({
  children,
  user,
  recentWorkflows,
}: {
  children: React.ReactNode
  user: User
  recentWorkflows: WorkflowListRow[]
}) {
  return (
    <SidebarProvider>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <AppSidebar recentWorkflows={recentWorkflows} user={user} />

        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Content — each page defines its own header via PageHeader */}
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
