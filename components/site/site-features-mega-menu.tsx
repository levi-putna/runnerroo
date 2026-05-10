"use client"

import * as React from "react"
import Link from "next/link"
import {
  BookOpen,
  ChevronDown,
  History,
  LayoutGrid,
  Layers,
  PanelRight,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type MegaMenuIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>

type MegaMenuLinkItem = {
  href: string
  title: string
  description: string
  Icon: MegaMenuIcon
}

type MegaMenuColumn = {
  heading: string
  items: MegaMenuLinkItem[]
}

const FEATURE_MEGA_MENU_COLUMNS: MegaMenuColumn[] = [
  {
    heading: "Product",
    items: [
      {
        href: "/features",
        title: "Features overview",
        description: "Assistant, workflows, and how they fit together",
        Icon: LayoutGrid,
      },
      {
        href: "/features/models",
        title: "Models catalogue",
        description: "Context windows, pricing, and provider coverage",
        Icon: Sparkles,
      },
    ],
  },
  {
    heading: "Assistant",
    items: [
      {
        href: "/learn/assistant",
        title: "Assistant guides",
        description: "Chat, tools, and day-to-day collaboration",
        Icon: BookOpen,
      },
      {
        href: "/learn/assistant/context",
        title: "Context sidebar",
        description: "Usage, memories, and attachments in view",
        Icon: PanelRight,
      },
      {
        href: "/learn/assistant/tools",
        title: "Tools",
        description: "How the assistant calls tools safely",
        Icon: Wrench,
      },
    ],
  },
  {
    heading: "Workflows",
    items: [
      {
        href: "/learn/workflows",
        title: "Workflows overview",
        description: "Triggers, branches, and orchestration concepts",
        Icon: Workflow,
      },
      {
        href: "/learn/workflows/building",
        title: "Building workflows",
        description: "Design patterns for graphs you can maintain",
        Icon: Layers,
      },
      {
        href: "/learn/workflows/runs",
        title: "Runs",
        description: "Execution history, schedules, and what to expect",
        Icon: History,
      },
    ],
  },
]

/**
 * Vercel-style mega menu for marketing “Features” — grouped columns with icon, title, and blurb.
 */
export function SiteFeaturesMegaMenu({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* Trigger aligned with other ghost nav pills */}
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "shrink-0 gap-1 px-3 font-normal text-foreground",
            open && "bg-accent text-accent-foreground",
            className,
          )}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          Features
          <ChevronDown
            className={cn("size-4 opacity-70 transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          "w-[min(100vw-2rem,52rem)] overflow-hidden rounded-xl border border-border/80 bg-popover p-0 shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
        )}
      >
        <div className="grid gap-0 md:grid-cols-3">
          {FEATURE_MEGA_MENU_COLUMNS.map((column) => (
            <div
              key={column.heading}
              className="border-b border-border/60 px-4 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              {/* Column heading — small caps like reference nav */}
              <p className="px-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {column.heading}
              </p>

              <ul className="flex flex-col gap-0.5">
                {column.items.map(({ href, title, description, Icon }) => (
                  <li key={href}>
                    <DropdownMenuItem asChild className="cursor-pointer p-0 focus:bg-transparent">
                      <Link
                        href={href}
                        className={cn(
                          "flex gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors",
                          "hover:bg-accent/80 focus-visible:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        )}
                        onClick={() => setOpen(false)}
                      >
                        {/* Icon tile */}
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70",
                            "bg-background/80 text-muted-foreground",
                          )}
                          aria-hidden
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>

                        {/* Title + description */}
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block text-sm font-medium leading-snug text-foreground">{title}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
