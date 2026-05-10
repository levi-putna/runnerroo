"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Renders Markdown blog body with GFM tables, task lists, and autolinks.
 */
export function BlogMarkdown({
  content,
}: {
  content: string
}) {
  return (
    <div className="site-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
