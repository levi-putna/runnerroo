import { cn } from "@/lib/utils"

/**
 * Tailwind classes for the user profile `Avatar` root: 10px corner radius and matching focus ring clip.
 */
export const userAvatarRootClassName = "rounded-[10px] after:rounded-[10px]"

/**
 * Tailwind classes for `AvatarImage` / `AvatarFallback` so they match the root radius.
 */
export const userAvatarInnerClassName = "rounded-[10px]"

/**
 * Combines optional size/layout classes with the standard user avatar root radius.
 */
export function userAvatarRootClass({ className }: { className?: string }) {
  return cn(userAvatarRootClassName, className)
}