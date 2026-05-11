import { cn } from "@/lib/utils"

export type ExpressionVariableTagProps = {
  /** Dot path inside the braces (for example `input.name` renders `{{input.name}}`). */
  id: string
  /** When `pill`, render with light purple background chip (Run code learn page). */
  variant?: "plain" | "pill"
  /** Prose body vs dense table text. */
  size?: "sm" | "xs"
  /** Merged onto the outer span. */
  className?: string
}

const SIZE_CLASS: Record<NonNullable<ExpressionVariableTagProps["size"]>, string> = {
  sm: "text-sm",
  xs: "text-xs",
}

/**
 * Inline workflow expression placeholder (`{{…}}`) for learn articles and step documentation.
 */
export function ExpressionVariableTag({
  id,
  variant = "plain",
  size = "sm",
  className,
}: ExpressionVariableTagProps) {
  return (
    <span
      className={cn(
        "not-prose whitespace-nowrap font-mono font-semibold text-[var(--purple)]",
        SIZE_CLASS[size],
        variant === "pill" && "inline-block rounded bg-[var(--purple-light)] px-1 py-0.5",
        className,
      )}
    >{`{{${id}}}`}</span>
  )
}
