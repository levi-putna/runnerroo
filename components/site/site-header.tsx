import Link from "next/link"
import { DailifyFullLogo } from "@/components/brand/dailify-logos"
import { SiteFeaturesMegaMenu } from "@/components/site/site-features-mega-menu"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
] as const

/**
 * Resolves a short display label for the signed-in user in the public site header.
 */
function resolveHeaderUserLabel({
  fullName,
  email,
}: {
  fullName: string | undefined
  email: string | undefined
}): string {
  if (fullName && fullName.trim().length > 0) return fullName.trim()
  if (email && email.includes("@")) return email.split("@")[0] ?? "Account"
  return "Account"
}

/**
 * Sticky marketing header with primary navigation and session-aware auth actions.
 */
export async function SiteHeader({
  className,
}: {
  className?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const authedLabel = user
    ? resolveHeaderUserLabel({
        fullName: user.user_metadata?.full_name as string | undefined,
        email: user.email ?? undefined,
      })
    : null

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center">
          {/* Brand — full logo from public/logo/full-logo.svg */}
          <DailifyFullLogo className="h-8 w-auto sm:h-9" priority />
        </Link>

        {/* Primary nav — scrolls on narrow viewports */}
        <nav
          className="flex min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto md:gap-1"
          aria-label="Primary"
        >
          {/* Features — mega menu (product, assistant, workflows) */}
          <SiteFeaturesMegaMenu />

          {NAV_LINKS.map(({ href, label }) => (
            <Button key={href} variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </nav>

        {/* Auth / account */}
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/workflows">{authedLabel}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Join</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
