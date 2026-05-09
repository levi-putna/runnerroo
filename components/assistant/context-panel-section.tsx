"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ContextPanelSectionProps = {
  /** Stable id wired to `aria-controls` on the section toggle. */
  regionId: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  children: React.ReactNode;
};

/**
 * Collapsible context-sidebar block with icon tile, title, subtitle, and expandable body region.
 */
export function ContextPanelSection({
  regionId,
  title,
  subtitle,
  icon: Icon,
  open,
  onOpenChange,
  children,
}: ContextPanelSectionProps) {
  return (
    <div className="flex flex-col">
      {/* Section heading — icon, text, chevron */}
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-3 rounded-lg p-1 text-left hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => onOpenChange(!open)}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <ChevronDownIcon
              className={cn(
                "mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
                open ? "rotate-180" : ""
              )}
              aria-hidden
            />
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
      </button>

      {/* Collapsible body */}
      <div id={regionId} role="region" hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
  );
}
