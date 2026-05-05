"use client"

import { BadgeCheck, Bell, ChevronsUpDown, CreditCard, LogOut, Monitor, Moon, Sparkles, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { getResolvedAvatarUrlForAuthUser } from "@/lib/avatar/dicebear"
import { userAvatarInnerClassName, userAvatarRootClass } from "@/lib/avatar/user-avatar-styles"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

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

/** Available theme options rendered in the tab switcher. */
const THEME_OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark",  label: "Dark",  Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const

type ThemeValue = typeof THEME_OPTIONS[number]["value"]

/**
 * Sidebar footer user menu.
 *
 * Displays the authenticated Supabase user's details and provides
 * sign-out and theme-switching controls.
 */
export function NavUser({ user: initialUser }: NavUserProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const [user, setUser] = useState<UserDetails>(initialUser)

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
        <DropdownMenu>
          {/* Trigger button showing avatar + name */}
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className={userAvatarRootClass({ className: "h-8 w-8" })}>
              <AvatarImage src={user.avatar} alt={user.name} className={userAvatarInnerClassName} />
              <AvatarFallback className={userAvatarInnerClassName}>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-72 rounded-lg"
            side="right"
            align="end"
            sideOffset={4}
          >
            {/* User identity header */}
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className={userAvatarRootClass({ className: "h-8 w-8" })}>
                <AvatarImage src={user.avatar} alt={user.name} className={userAvatarInnerClassName} />
                <AvatarFallback className={userAvatarInnerClassName}>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
            </div>

            {/* Theme switcher — tab-style row */}
            <div className="px-1 pb-1.5">
              <div className="inline-flex w-full items-center rounded-lg bg-muted p-1">
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium whitespace-nowrap transition-[color,box-shadow]",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                      currentTheme === value
                        ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                        : "text-muted-foreground hover:text-foreground dark:text-muted-foreground"
                    )}
                    aria-pressed={currentTheme === value}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Upgrade prompt */}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Account actions */}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Sign out */}
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
