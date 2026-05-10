import type { Metadata } from "next"
import type { ReactNode } from "react"

import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

export const metadata: Metadata = {
  title: {
    default: "Dailify",
    template: "%s | Dailify",
  },
}

/**
 * Public marketing and documentation shell: isolated from the authenticated `app/app` layout.
 */
export default function SiteLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div
      data-site
      className="site-root flex min-h-dvh flex-col bg-background text-foreground"
    >
      {/* Global chrome */}
      <SiteHeader />

      {/* Page content */}
      <div className="flex flex-1 flex-col">{children}</div>

      <SiteFooter />
    </div>
  )
}
