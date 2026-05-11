import { highlight } from "sugar-high"

import { cn } from "@/lib/utils"

type SugarHighCodeBlockProps = {
  /** Raw JavaScript or JSX source — highlighted with {@link https://github.com/huozhi/sugar-high sugar-high}. */
  code: string
  /** Extra classes on the outer `pre` (layout, border, spacing). */
  className?: string
}

/**
 * Renders a JavaScript snippet with sugar-high token spans. Pair with global `.sh-code-block` theme variables.
 */
export function SugarHighCodeBlock({ code, className }: SugarHighCodeBlockProps) {
  const html = highlight(code)

  return (
    <pre
      className={cn(
        "sh-code-block overflow-x-auto rounded-lg border border-border/80 bg-muted/40 text-sm leading-relaxed",
        className,
      )}
    >
      {/* Highlighted tokens — static author code only */}
      <code
        className="block w-full min-w-0 font-mono text-[13px] leading-relaxed [&_.sh__line]:block"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  )
}
