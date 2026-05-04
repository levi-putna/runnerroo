"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  WORKFLOW_STEP_GROUP_META,
  type WorkflowStepGroupId,
} from "@/lib/workflow/node-type-registry"
import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface NodeDefinition {
  type: string
  subtype?: string
  label: string
  description: string
  defaultData: Record<string, unknown>
  group: WorkflowStepGroupId
}

interface NodeGroupDefinition {
  group: WorkflowStepGroupId
  nodes: NodeDefinition[]
}

/**
 * Renders the step picker section label (Lucide icon + title + count).
 */
function NodeGroupHeading({
  groupId,
  count,
}: {
  groupId: WorkflowStepGroupId
  count: number
}) {
  const { Icon, title } = WORKFLOW_STEP_GROUP_META[groupId]

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
      {/* Group icon — plain glyph, aligned with uppercase label */}
      <Icon
        className="size-4 shrink-0 text-muted-foreground"
        strokeWidth={2}
        aria-hidden
      />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
        {count}
      </Badge>
    </div>
  )
}

const nodeGroups: NodeGroupDefinition[] = [
  {
    group: "triggers",
    nodes: [
      {
        type: "entry",
        label: "Manual run",
        description: "Trigger the workflow manually",
        group: "triggers",
        defaultData: { label: "Manual run", entryType: "manual" },
      },
      {
        type: "entry",
        subtype: "webhook",
        label: "Webhook",
        description: "Trigger via HTTP request",
        group: "triggers",
        defaultData: { label: "Webhook", entryType: "webhook" },
      },
      {
        type: "entry",
        subtype: "schedule",
        label: "Schedule",
        description: "Trigger on a cron schedule",
        group: "triggers",
        defaultData: { label: "Schedule", entryType: "schedule" },
      },
    ],
  },
  {
    group: "logic",
    nodes: [
      {
        type: "decision",
        label: "Decision",
        description: "Branch based on a condition",
        group: "logic",
        defaultData: { label: "Decision", description: "Check a condition and branch" },
      },
      {
        type: "switch",
        label: "Switch",
        description: "Route to multiple paths with ordered conditions and an else branch",
        group: "logic",
        defaultData: {
          label: "Switch",
          description: "Evaluate cases in order; use Else when none match",
          defaultBranchLabel: "Else",
          branches: [
            { id: "sw-a", label: "Case A", condition: "" },
            { id: "sw-b", label: "Case B", condition: "" },
          ],
        },
      },
      {
        type: "split",
        label: "Split",
        description: "Send the same inbound payload to every connected outbound path in parallel",
        group: "logic",
        defaultData: {
          label: "Split",
          description: "Each path receives an identical copy of the upstream payload",
          paths: [
            { id: "sp-a", label: "Path A" },
            { id: "sp-b", label: "Path B" },
          ],
        },
      },
    ],
  },
  {
    group: "ai",
    nodes: [
      {
        type: "ai",
        subtype: "generate",
        label: "Generate text",
        description: "Generate content using an AI model",
        group: "ai",
        defaultData: { label: "Generate text", subtype: "generate", model: "claude-sonnet-4-6" },
      },
      {
        type: "ai",
        subtype: "summarize",
        label: "Summarise",
        description: "Condense text into a summary",
        group: "ai",
        defaultData: { label: "Summarise content", subtype: "summarize", model: "claude-sonnet-4-6" },
      },
      {
        type: "ai",
        subtype: "classify",
        label: "Classify",
        description: "Categorise or label input data",
        group: "ai",
        defaultData: { label: "Classify input", subtype: "classify", model: "claude-sonnet-4-6" },
      },
      {
        type: "ai",
        subtype: "extract",
        label: "Extract data",
        description: "Pull structured data from text",
        group: "ai",
        defaultData: { label: "Extract data", subtype: "extract", model: "claude-sonnet-4-6" },
      },
      {
        type: "ai",
        subtype: "chat",
        label: "Chat",
        description: "Multi-turn chat completion",
        group: "ai",
        defaultData: { label: "Chat completion", subtype: "chat", model: "claude-sonnet-4-6" },
      },
      {
        type: "ai",
        subtype: "transform",
        label: "Transform",
        description: "Rewrite or restructure data with AI",
        group: "ai",
        defaultData: { label: "Transform data", subtype: "transform", model: "claude-sonnet-4-6" },
      },
    ],
  },
  {
    group: "code",
    nodes: [
      {
        type: "code",
        label: "Run code",
        description: "Execute TypeScript in a Vercel Sandbox",
        group: "code",
        defaultData: {
          label: "Run code",
          language: "typescript",
          description: "Execute custom code",
          code: "export default async function run(input: unknown) {\n  return input\n}",
        },
      },
      {
        type: "random",
        label: "Random number",
        description: "Draw a uniform value between configurable min and max bounds",
        group: "code",
        defaultData: {
          label: "Random number",
          description: "Generate a random number from resolved lower and upper bounds",
        },
      },
      {
        type: "iteration",
        label: "Iteration",
        description: "Add an increment (default 1) to a starting number from the inputs",
        group: "code",
        defaultData: {
          label: "Iteration",
          description: "Advance a numeric counter by an expression-backed increment",
          iterationIncrement: "1",
        },
      },
    ],
  },
  {
    group: "actions",
    nodes: [
      {
        type: "action",
        label: "Action",
        description: "A generic workflow action step",
        group: "actions",
        defaultData: { label: "New action", description: "Perform an action" },
      },
    ],
  },
  {
    group: "termination",
    nodes: [
      {
        type: "end",
        label: "End",
        description: "Stop the workflow — accepts connections in, none out",
        group: "termination",
        defaultData: {
          label: "End",
          description: "Execution stops here when this branch is reached.",
        },
      },
    ],
  },
]

interface NodeAddSheetProps {
  open: boolean
  onClose: () => void
  onAdd: (def: NodeDefinition) => void
}

/**
 * Resolves `entryType` / `aiSubtype` hints for the shared tile renderer from catalogue rows.
 */
function getPickerEntryType({ node }: { node: NodeDefinition }): string | undefined {
  if (node.type !== "entry") return undefined
  return (node.subtype ?? "manual") as string
}

/**
 * Resolves AI subtype for picker tiles (undefined falls back to generate in the registry).
 */
function getPickerAiSubtype({ node }: { node: NodeDefinition }): string | undefined {
  if (node.type !== "ai") return undefined
  return node.subtype
}

/**
 * One-line truncated description with full copy on hover (keyboard users still get the row action via the parent control).
 */
function NodePickerDescription({ description }: { description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        closeOnClick={false}
        delay={200}
        render={(props) => (
          <span
            {...props}
            className={cn(
              "block min-w-0 text-xs text-muted-foreground mt-0.5 truncate leading-tight",
              props.className
            )}
          >
            {description}
          </span>
        )}
      />
      <TooltipContent side="left" align="start" className="max-w-xs text-left">
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Right-hand sheet to search and pick a workflow step type from the catalogue.
 */
export function NodeAddSheet({ open, onClose, onAdd }: NodeAddSheetProps) {
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!query.trim()) return nodeGroups
    const q = query.toLowerCase()
    return nodeGroups
      .map((g) => ({
        ...g,
        nodes: g.nodes.filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            n.description.toLowerCase().includes(q) ||
            WORKFLOW_STEP_GROUP_META[g.group].title.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.nodes.length > 0)
  }, [query])

  function handleAdd(def: NodeDefinition) {
    onAdd(def)
    onClose()
    setQuery("")
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[360px] p-0 flex min-h-0 flex-col overflow-hidden"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetTitle className="text-base">Add step</SheetTitle>
          <SheetDescription className="sr-only">Choose a node type to add to your workflow</SheetDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search steps…"
              className="pl-9"
            />
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 py-2">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No steps match &ldquo;{query}&rdquo;
              </p>
            )}

            {filtered.map((group) => (
              <div key={group.group} className="mb-3">
                <NodeGroupHeading groupId={group.group} count={group.nodes.length} />

                {/* Tighter vertical rhythm between step rows */}
                <div className="space-y-0.5">
                  {group.nodes.map((node) => (
                    <button
                      key={`${node.type}-${node.subtype ?? "default"}`}
                      onClick={() => handleAdd(node)}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left",
                        "hover:bg-accent transition-colors group"
                      )}
                    >
                      {/* Step tile — same registry accent + icon as canvas */}
                      <WorkflowNodeIconTile
                        type={node.type}
                        size="md"
                        frameClassName="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        entryType={getPickerEntryType({ node })}
                        aiSubtype={getPickerAiSubtype({ node })}
                      />
                      {/* Label + single-line description (full text in tooltip) */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{node.label}</p>
                        <NodePickerDescription description={node.description} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
