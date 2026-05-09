"use client"

import Link from "next/link"
import {
  BookOpen,
  Home,
  LifeBuoy,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  PenLine,
  Settings,
  SmilePlus,
  Sun,
} from "lucide-react"
import { useTheme } from "@teispace/next-themes"
import { useEffect, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import { getResolvedAvatarUrlForAuthUser } from "@/lib/avatar/dicebear"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { UserFeedbackDialog } from "@/components/feedback/user-feedback-dialog"
import { Button } from "@/components/ui/button"

interface UserDetails {
  name: string
  email: string
  /** Resolved profile image URL (DiceBear or saved custom). */
  avatar: string
}

interface NavUserProps {
  /** Initial user details passed from the server layout as a loading fallback. */
  user: UserDetails
}

/** Theme control: system first so the icon order matches common layout (display, light, dark). */
const THEME_OPTIONS = [
  { value: "system" as const, label: "System", Icon: Monitor },
  { value: "light" as const, label: "Light", Icon: Sun },
  { value: "dark" as const, label: "Dark", Icon: Moon },
]

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"]

/**
 * Sidebar footer user menu: profile header with settings link, feedback dialog, theme control, and sign out.
 */
export function NavUser({ user: initialUser }: NavUserProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const [user, setUser] = useState<UserDetails>(initialUser)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Sync live Supabase session into local state on mount.
  useEffect(() => {
    async function loadUser() {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser()
      if (!supabaseUser) return

      setUser({
        name: supabaseUser.user_metadata?.full_name ?? supabaseUser.email?.split("@")[0] ?? "User",
        email: supabaseUser.email ?? "",
        avatar: getResolvedAvatarUrlForAuthUser({ user: supabaseUser }),
      })
    }

    loadUser()
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const currentTheme: ThemeValue = (theme as ThemeValue) ?? "system"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

        <DropdownMenu>
          {/* Trigger — avatar, name stack, overflow affordance */}
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar src={user.avatar} alt={user.name} fallback={initials} className="h-8 w-8" />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <MoreHorizontal className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-72 rounded-xl p-1.5 shadow-lg ring-1 ring-border/60"
            side="right"
            align="end"
            sideOffset={4}
          >
            {/* Header — name, email, settings shortcut */}
            <div className="flex items-start justify-between gap-2 px-2 pb-2 pt-1">
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
                <Link href="/app/settings/profile" aria-label="Profile and settings">
                  <Settings className="size-4" />
                </Link>
              </Button>
            </div>

            {/* Feedback */}
            <DropdownMenuItem
              className="justify-between gap-3 rounded-lg"
              onSelect={() => {
                setFeedbackOpen(true)
              }}
            >
              <span>Feedback</span>
              <SmilePlus className="size-4 text-muted-foreground" />
            </DropdownMenuItem>

            {/* Theme — label left, compact icon segment right */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="text-sm text-foreground">Theme</span>
              <div
                className="inline-flex shrink-0 items-center rounded-lg bg-muted p-0.5"
                role="group"
                aria-label="Theme"
              >
                {THEME_OPTIONS.map(({ value, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-md border border-transparent transition-[color,box-shadow,background-color]",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                      currentTheme === value
                        ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={currentTheme === value}
                    aria-label={value}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <DropdownMenuSeparator className="my-1.5" />

            {/* Placeholder links — no destination yet */}
            <DropdownMenuItem
              className="justify-between gap-3 rounded-lg"
              onSelect={(e) => e.preventDefault()}
            >
              <span>Home Page</span>
              <Home className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="justify-between gap-3 rounded-lg"
              onSelect={(e) => e.preventDefault()}
            >
              <span>Changelog</span>
              <PenLine className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="justify-between gap-3 rounded-lg"
              onSelect={(e) => e.preventDefault()}
            >
              <span>Help</span>
              <LifeBuoy className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="justify-between gap-3 rounded-lg"
              onSelect={(e) => e.preventDefault()}
            >
              <span>Docs</span>
              <BookOpen className="size-4 text-muted-foreground" />
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1.5" />

            <DropdownMenuItem
              className="justify-between gap-3 rounded-lg"
              onSelect={() => {
                void handleSignOut()
              }}
            >
              <span>Log out</span>
              <LogOut className="size-4 text-muted-foreground" />
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1.5" />

            {/* Platform status footer */}
            <div className="space-y-0.5 px-2 pb-1 pt-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Platform status
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">All systems normal.</span>
                <span
                  className="size-2 shrink-0 rounded-full bg-blue-500"
                  aria-hidden
                />
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
