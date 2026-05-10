import type { Metadata } from "next"
import Link from "next/link"

import { getAllBlogPosts } from "@/lib/blog/posts"

export const metadata: Metadata = {
  title: "Blog | Dailify",
  description: "Product updates, guides, and notes from the Dailify team.",
  openGraph: {
    title: "Blog | Dailify",
    description: "Product updates, guides, and notes from the Dailify team.",
  },
}

/**
 * Blog index: lists Markdown posts from `content/blog/`.
 */
export default function BlogIndexPage() {
  const posts = getAllBlogPosts()

  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6">
      {/* Page header */}
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Blog</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Updates and longer-form notes. Add Markdown files under <code className="font-mono text-sm">content/blog</code>
          .
        </p>
      </header>

      {/* Post list */}
      <ul className="space-y-6">
        {posts.map((post) => (
          <li key={post.slug} className="rounded-xl border border-border/70 bg-card/40 p-6 shadow-sm backdrop-blur-sm">
            <Link href={`/blog/${post.slug}`} className="group block">
              <h2 className="text-xl font-semibold tracking-tight text-foreground group-hover:underline">
                {post.title}
              </h2>
              {post.date ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground">{post.date}</p>
              ) : null}
              {post.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts yet. Add a <code className="font-mono text-sm">.md</code> file to get started.</p>
      ) : null}
    </div>
  )
}
