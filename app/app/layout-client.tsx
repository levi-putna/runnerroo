"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import type { WorkflowListRow } from "@/lib/workflows/queries"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"

interface User {
  name: string
  email: string
  avatar?: string
}

function useBreadcrumbs(pathname: string) {
  // Strip the leading /app segment — it's a URL namespace, not a meaningful crumb
  const strippedPath = pathname.replace(/^\/app/, "") || "/"
  const segments = strippedPath.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "Workflows", href: "/app/workflows" }]

  const crumbs: { label: string; href: string }[] = []
  const labelMap: Record<string, string> = {
    workflows: "Workflows",
    settings: "Settings",
    profile: "Profile",
    integrations: "Integrations",
    runs: "Run history",
    run: "Runs",
    analytics: "Analytics",
    triggers: "Triggers",
    new: "New workflow",
    chat: "Chat",
  }

  const isLikelyWorkflowOrRunUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    )

  let path = "/app"
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    path += `/${seg}`
    const prev = i > 0 ? segments[i - 1] : null
    let label: string
    if (labelMap[seg]) {
      label = labelMap[seg]
    } else if (prev === "run" && isLikelyWorkflowOrRunUuid(seg)) {
      label = `Run ${seg.slice(0, 8)}…`
    } else if (seg.length > 8 && !labelMap[seg]) {
      label = "Editor"
    } else {
      label = seg
    }
    crumbs.push({ label, href: path })
  }
  return crumbs
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
  const pathname = usePathname()
  const crumbs = useBreadcrumbs(pathname)

  return (
    <SidebarProvider>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <AppSidebar recentWorkflows={recentWorkflows} user={user} />

        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="h-4" />

            {/* Breadcrumbs */}
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="flex-nowrap">
                {crumbs.map((crumb, i) => (
                  <React.Fragment key={crumb.href}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {i < crumbs.length - 1 ? (
                        <BreadcrumbLink
                          href={crumb.href}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="font-medium">{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <ThemeToggle />
          </header>

          {/* Content */}
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
