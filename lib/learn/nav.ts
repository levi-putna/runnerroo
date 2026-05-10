/**
 * A single entry in the Learn sidebar navigation tree.
 */
export type LearnNavItem = {
  title: string
  href: string
  children?: LearnNavItem[]
}

/**
 * Hierarchical navigation for `/learn` documentation pages.
 */
export const LEARN_NAV: LearnNavItem[] = [
  {
    title: "Overview",
    href: "/learn",
  },
  {
    title: "Getting started",
    href: "/learn/getting-started",
  },
  {
    title: "Workflows",
    href: "/learn/workflows",
    children: [
      { title: "Building a flow", href: "/learn/workflows/building" },
      { title: "Runs and schedules", href: "/learn/workflows/runs" },
    ],
  },
  {
    title: "Assistant",
    href: "/learn/assistant",
    children: [
      { title: "Chat and context", href: "/learn/assistant/context" },
      { title: "Tools and approvals", href: "/learn/assistant/tools" },
    ],
  },
]

/**
 * Flattens {@link LEARN_NAV} for quick lookup or active-path checks.
 */
export function flattenLearnNav({
  items,
}: {
  items?: LearnNavItem[]
} = {}): LearnNavItem[] {
  const list = items ?? LEARN_NAV
  const out: LearnNavItem[] = []
  for (const item of list) {
    out.push(item)
    if (item.children?.length) {
      out.push(...flattenLearnNav({ items: item.children }))
    }
  }
  return out
}
