import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BlogMarkdown } from "@/components/site/blog-markdown"
import { Button } from "@/components/ui/button"
import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/blog/posts"

type BlogPostPageProps = {
  params: Promise<{ slug: string }>
}

/**
 * Static params for every Markdown slug under `content/blog/`.
 */
export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }))
}

/**
 * Open Graph and document title for a Markdown blog post.
 */
export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPostBySlug({ slug })
  if (!post) return { title: "Post — Dailify" }
  return {
    title: `${post.title} — Blog — Dailify`,
    description: post.description || post.title,
    openGraph: {
      title: `${post.title} — Dailify`,
      description: post.description || post.title,
    },
  }
}

/**
 * Blog article detail — Markdown body rendered via {@link BlogMarkdown}.
 */
export default async function BlogPostPage({
  params,
}: BlogPostPageProps) {
  const { slug } = await params
  const post = getBlogPostBySlug({ slug })
  if (!post) notFound()

  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/blog" className="hover:text-foreground">
          Blog
        </Link>
        <span className="px-2">/</span>
        <span className="text-foreground">{post.title}</span>
      </nav>

      {/* Article header */}
      <header className="mb-10 border-b border-border/60 pb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">{post.title}</h1>
        {post.date ? <p className="mt-2 font-mono text-sm text-muted-foreground">{post.date}</p> : null}
      </header>

      {/* Body */}
      <BlogMarkdown content={post.content} />

      <div className="mt-12">
        <Button variant="outline" asChild>
          <Link href="/blog">Back to blog</Link>
        </Button>
      </div>
    </div>
  )
}
