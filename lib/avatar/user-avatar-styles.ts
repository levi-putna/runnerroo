import { cn } from "@/lib/utils"

/**
 * Class for the user profile `Avatar` root: overflow clip + `app/globals.css` radii on image/fallback.
 */
export const userAvatarRootClassName = "user-avatar-root"

/**
 * Extra classes on `AvatarImage` / `AvatarFallback`; corner radius comes from CSS (`--radius-sm` on those slots).
 */
export const userAvatarInnerClassName = "object-cover"

/**
 * Combines optional size/layout classes with the standard user avatar root styling.
 */
export function userAvatarRootClass({ className }: { className?: string }) {
  return cn(userAvatarRootClassName, className)
}