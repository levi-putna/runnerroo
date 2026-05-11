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
      {
        title: "Steps and behaviour",
        href: "/learn/workflows/steps",
        children: [
          { title: "Expression variables", href: "/learn/workflows/steps/expressions" },
          { title: "Execution settings", href: "/learn/workflows/steps/execution-settings" },
          {
            title: "Triggers",
            href: "/learn/workflows/steps/triggers",
            children: [
              { title: "Invoke", href: "/learn/workflows/steps/triggers/invoke" },
              { title: "Webhook", href: "/learn/workflows/steps/triggers/webhook" },
              { title: "Schedule", href: "/learn/workflows/steps/triggers/schedule" },
            ],
          },
          {
            title: "Logic",
            href: "/learn/workflows/steps/logic",
            children: [
              { title: "Decision", href: "/learn/workflows/steps/logic/decision" },
              { title: "Switch", href: "/learn/workflows/steps/logic/switch" },
              { title: "Split", href: "/learn/workflows/steps/logic/split" },
            ],
          },
          {
            title: "Human",
            href: "/learn/workflows/steps/human",
            children: [{ title: "Approval", href: "/learn/workflows/steps/human/approval" }],
          },
          {
            title: "AI",
            href: "/learn/workflows/steps/ai",
            children: [
              { title: "Generate text", href: "/learn/workflows/steps/ai/generate" },
              { title: "Summarise content", href: "/learn/workflows/steps/ai/summarize" },
              { title: "Classify input", href: "/learn/workflows/steps/ai/classify" },
              { title: "Extract data", href: "/learn/workflows/steps/ai/extract" },
              { title: "Chat completion", href: "/learn/workflows/steps/ai/chat" },
              { title: "Transform data", href: "/learn/workflows/steps/ai/transform" },
            ],
          },
          {
            title: "Code",
            href: "/learn/workflows/steps/code",
            children: [
              { title: "Run code", href: "/learn/workflows/steps/code" },
              { title: "Random number", href: "/learn/workflows/steps/code/random" },
              { title: "Iteration", href: "/learn/workflows/steps/code/iteration" },
            ],
          },
          {
            title: "Documents",
            href: "/learn/workflows/steps/documents",
            children: [
              { title: "Document from Template", href: "/learn/workflows/steps/documents/template" },
              { title: "Generate document (XML)", href: "/learn/workflows/steps/documents/docxml" },
            ],
          },
          {
            title: "Actions",
            href: "/learn/workflows/steps/actions",
            children: [
              { title: "Action", href: "/learn/workflows/steps/actions/built-in" },
              { title: "Webhook", href: "/learn/workflows/steps/actions/webhook-call" },
            ],
          },
          {
            title: "Termination",
            href: "/learn/workflows/steps/termination",
            children: [{ title: "End", href: "/learn/workflows/steps/termination/end" }],
          },
        ],
      },
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
 * Returns the set of parent {@link LearnNavItem.href} values that must be
 * expanded to reveal `pathname` in the tree (including an item when
 * `pathname` equals that item and it has children).
 */
export function collectLearnNavExpandedHrefsForPathname({
  items,
  pathname,
}: {
  items: LearnNavItem[]
  pathname: string
}): Set<string> {
  const expanded = new Set<string>()

  /**
   * @returns True when this subtree contains the active route.
   */
  function walk(nodes: LearnNavItem[]): boolean {
    for (const node of nodes) {
      const children = node.children
      if (children?.length) {
        const childHit = walk(children)
        if (pathname === node.href || childHit) {
          expanded.add(node.href)
          return true
        }
      } else if (pathname === node.href) {
        return true
      }
    }
    return false
  }

  walk(items)
  return expanded
}

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
