import type { ReactNode } from "react"

import { LearnDocsShell } from "@/components/site/learn-docs-shell"
import { LEARN_NAV } from "@/lib/learn/nav"

/**
 * Learn documentation area: sidebar + mobile sheet from {@link LearnDocsShell}.
 */
export default function LearnLayout({
  children,
}: {
  children: ReactNode
}) {
  return <LearnDocsShell nav={LEARN_NAV}>{children}</LearnDocsShell>
}
