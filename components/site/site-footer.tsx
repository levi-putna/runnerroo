import Link from "next/link"
import { DailifyFullLogo } from "@/components/brand/dailify-logos"
import { cn } from "@/lib/utils"

const FOOTER_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/features/models", label: "Models" },
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/about", label: "About" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
] as const

/**
 * Site-wide footer with legal and secondary navigation.
 */
export function SiteFooter({
  className,
}: {
  className?: string
}) {
  return (
    <footer className={cn("border-t border-border/60 bg-muted/30", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
        {/* Top row — brand + links */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center">
            {/* Brand — full logo */}
            <DailifyFullLogo className="h-7 w-auto opacity-90" />
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom — copyright */}
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Dailify. Visual workflow automation for teams.
        </p>
      </div>
    </footer>
  )
}
