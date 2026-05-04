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
import { AiSidebar } from "@/components/ai-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Bot } from "lucide-react"

interface User {
  name: string
  email: string
  avatar?: string
}

function useBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "Workflows", href: "/workflows" }]

  const crumbs: { label: string; href: string }[] = []
  const labelMap: Record<string, string> = {
    workflows: "Workflows",
    settings: "Settings",
    profile: "Profile",
    integrations: "Integrations",
    runs: "Run history",
    analytics: "Analytics",
    triggers: "Triggers",
    new: "New workflow",
  }

  let path = ""
  for (const seg of segments) {
    path += `/${seg}`
    const isId = seg.length > 8 && !labelMap[seg]
    crumbs.push({ label: isId ? "Editor" : (labelMap[seg] ?? seg), href: path })
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
  const [aiSidebarOpen, setAiSidebarOpen] = React.useState(false)
  const [aiSidebarWidth, setAiSidebarWidth] = React.useState(360)
  const pathname = usePathname()
  const crumbs = useBreadcrumbs(pathname)

  return (
    <SidebarProvider>
      <div className="flex h-full w-full overflow-hidden">
        <AppSidebar recentWorkflows={recentWorkflows} user={user} />

        <SidebarInset className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="h-4" />

            {/* Breadcrumbs */}
            <Breadcrumb className="flex-1 min-w-0">
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

            <Button
              variant={aiSidebarOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setAiSidebarOpen((o) => !o)}
              className="gap-1.5 h-7 text-xs"
            >
              <Bot className="size-3.5" />
              <span className="hidden sm:inline">Assistant</span>
            </Button>
          </header>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto">
              {children}
            </main>
            <AiSidebar
              isOpen={aiSidebarOpen}
              onClose={() => setAiSidebarOpen(false)}
              width={aiSidebarWidth}
              onWidthChange={setAiSidebarWidth}
            />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
