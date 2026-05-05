import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { userAvatarInnerClassName, userAvatarRootClass } from "@/lib/avatar/user-avatar-styles"
import { cn } from "@/lib/utils"

/**
 * App-standard user avatar: DiceBear / profile image with shared radius and clipping (`app/globals.css` `.user-avatar-root`).
 */
export function UserAvatar({
  src,
  alt,
  fallback,
  className,
  fallbackClassName,
}: {
  src: string
  alt: string
  fallback: ReactNode
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={userAvatarRootClass({ className: cn("shrink-0", className) })}>
      <AvatarImage src={src} alt={alt} className={userAvatarInnerClassName} />
      <AvatarFallback className={cn(userAvatarInnerClassName, fallbackClassName)}>{fallback}</AvatarFallback>
    </Avatar>
  )
}
