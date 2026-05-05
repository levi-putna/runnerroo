"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus,
  Workflow,
  Clock,
  Webhook,
  Command,
  Activity,
  MoreHorizontal,
  Play,
  Zap,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { WorkflowListRow } from "@/lib/workflows/queries/queries"

const triggerMeta = {
  cron: { icon: Clock, label: "Schedule" },
  webhook: { icon: Webhook, label: "Webhook" },
  manual: { icon: Command, label: "Manual" },
}

function TimeAgo({ date }: { date: string }) {
  const [label, setLabel] = React.useState("")

  React.useEffect(() => {
    function updateLabel() {
      const diff = Date.now() - new Date(date).getTime()
      const mins = Math.floor(diff / 60000)
      const hours = Math.floor(mins / 60)
      const days = Math.floor(hours / 24)
      if (days > 0) setLabel(`${days}d ago`)
      else if (hours > 0) setLabel(`${hours}h ago`)
      else setLabel(`${Math.max(0, mins)}m ago`)
    }
    updateLabel()
    const id = window.setInterval(updateLabel, 60_000)
    return () => window.clearInterval(id)
  }, [date])

  return <>{label}</>
}

function StatusBadge({ status }: { status: "active" | "inactive" | "draft" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md",
        status === "active" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
        status === "draft" && "bg-muted text-muted-foreground",
        status === "inactive" && "bg-muted text-muted-foreground"
      )}
    >
      {status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
      {status}
    </span>
  )
}

function triggerSummary(w: WorkflowListRow) {
  const cfg = w.trigger_config && typeof w.trigger_config === "object" ? (w.trigger_config as Record<string, unknown>) : {}
  if (w.trigger_type === "cron") {
    const schedule = typeof cfg.schedule === "string" ? cfg.schedule : "—"
    return schedule
  }
  if (w.trigger_type === "webhook") {
    const path = typeof cfg.path === "string" ? cfg.path : "/webhook"
    return path
  }
  return "Manual"
}

interface WorkflowsIndexProps {
  workflows: WorkflowListRow[]
}

/**
 * Workflows home: stats row, sortable-style cards, and destructive actions via the row menu.
 */
export function WorkflowsIndex({ workflows }: WorkflowsIndexProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  async function handleDeleteWorkflow(p: { workflowId: string }) {
    if (!window.confirm("Delete this workflow? This cannot be undone.")) return
    setDeletingId(p.workflowId)
    try {
      const res = await fetch(`/api/workflows/${p.workflowId}`, { method: "DELETE" })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        window.alert(json.error ?? "Could not delete workflow")
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const stats = [
    { label: "Total", value: workflows.length, icon: Workflow, color: "text-foreground" },
    {
      label: "Active",
      value: workflows.filter((w) => w.status === "active").length,
      icon: Zap,
      color: "text-emerald-600",
    },
    {
      label: "Runs",
      value: workflows.reduce((a, w) => a + w.run_count, 0).toLocaleString(),
      icon: Activity,
      color: "text-blue-600",
    },
    {
      label: "Triggers",
      value: new Set(workflows.map((w) => w.trigger_type)).size,
      icon: Webhook,
      color: "text-violet-600",
    },
  ]

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <PageHeader title="Workflows" description="Build and automate your processes">
        <Link href="/app/workflows/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            New workflow
          </Button>
        </Link>
      </PageHeader>

      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xl font-semibold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <stat.icon className={cn("size-7 opacity-20", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow list */}
      <div className="space-y-2">
        {workflows.map((workflow) => {
          const tMeta = triggerMeta[workflow.trigger_type] ?? triggerMeta.manual
          const TIcon = tMeta.icon

          return (
            <Card key={workflow.id} className="group transition-shadow hover:shadow-sm">
              <CardContent>
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                    <Workflow className="size-4 text-muted-foreground" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/app/workflows/${workflow.id}`}
                        className="text-sm font-medium hover:underline underline-offset-2 truncate"
                      >
                        {workflow.name}
                      </Link>
                      <StatusBadge status={workflow.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TIcon className="size-3" />
                        {triggerSummary(workflow)}
                      </span>
                      {workflow.run_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Activity className="size-3" />
                          {workflow.run_count.toLocaleString()} runs
                        </span>
                      )}
                      {workflow.last_run_at && (
                        <span className="flex items-center gap-1">
                          <Play className="size-3" />
                          <TimeAgo date={workflow.last_run_at} />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Link href={`/app/workflows/${workflow.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Open
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="icon-sm" variant="ghost" aria-label="More options" />
                        }
                      >
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/app/workflows/${workflow.id}`)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem disabled>View runs</DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={deletingId === workflow.id}
                          onClick={() => void handleDeleteWorkflow({ workflowId: workflow.id })}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {workflows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Workflow className="size-6 text-muted-foreground/50" />
          </div>
          <h3 className="font-medium">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first workflow to get started</p>
          <Link href="/app/workflows/new" className="mt-4">
            <Button size="sm">
              <Plus className="size-3.5 mr-1.5" />
              New workflow
            </Button>
          </Link>
        </div>
      )}
      </div>
    </div>
  )
}
