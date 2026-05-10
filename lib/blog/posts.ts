import fs from "node:fs"
import path from "node:path"

import matter from "gray-matter"

const BLOG_DIR = path.join(process.cwd(), "content", "blog")

/**
 * Front matter for a Markdown blog post under `content/blog/`.
 */
export type BlogPostFrontMatter = {
  title: string
  description?: string
  date?: string
}

/**
 * Parsed blog post used by listing and detail routes.
 */
export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  content: string
}

/**
 * Reads every `.md` file from `content/blog/` and returns sorted posts (newest first).
 */
export function getAllBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((name) => name.endsWith(".md"))
  const posts = files.map((filename) => {
    const slug = filename.replace(/\.md$/, "")
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8")
    const { data, content } = matter(raw)
    const fm = data as Partial<BlogPostFrontMatter>
    const title = fm.title ?? slug
    const description = fm.description ?? ""
    const date = fm.date ?? ""
    return { slug, title, description, date, content }
  })

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return posts
}

/**
 * Returns a single post by slug, or `null` when missing.
 */
export function getBlogPostBySlug({ slug }: { slug: string }): BlogPost | null {
  const file = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(file)) return null
  const raw = fs.readFileSync(file, "utf8")
  const { data, content } = matter(raw)
  const fm = data as Partial<BlogPostFrontMatter>
  const title = fm.title ?? slug
  const description = fm.description ?? ""
  const date = fm.date ?? ""
  return { slug, title, description, date, content }
}
