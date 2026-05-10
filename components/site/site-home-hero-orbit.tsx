"use client"

import { Bot, GitBranch, Sparkles, Workflow } from "lucide-react"

import { OrbitingIcons } from "@/components/site/magic/orbiting-icons"

/**
 * Hero orbiting icon ring — icons are imported here so the home page (RSC) does not pass component refs to a client boundary.
 */
export function SiteHomeHeroOrbit() {
  return <OrbitingIcons icons={[Sparkles, Workflow, GitBranch, Bot]} />
}
