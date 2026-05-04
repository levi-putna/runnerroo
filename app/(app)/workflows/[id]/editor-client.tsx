"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Play, Save, History } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  defaultWorkflowCanvasNodes,
  parseWorkflowEdges,
  parseWorkflowNodes,
  workflowGraphBaseline,
} from "@/lib/workflow/persist"
import type { Database } from "@/types/database"

type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"]

interface WorkflowEditorClientProps {
  workflowId: string
  initialWorkflow: WorkflowRow | null
}

const statusConfig = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
}

/**
 * Client workflow editor: toolbar, canvas, save/load via API, and unsaved navigation guard.
 */
export function WorkflowEditorClient({ workflowId, initialWorkflow }: WorkflowEditorClientProps) {
  const router = useRouter()
  const isNew = workflowId === "new"
  const canvasRef = React.useRef<WorkflowCanvasHandle>(null)

  const initialName = initialWorkflow?.name ?? "Untitled workflow"
  const initialStatus = (initialWorkflow?.status ?? "draft") as "active" | "inactive" | "draft"

  const [workflowName, setWorkflowName] = React.useState(initialName)
  const [status] = React.useState<"active" | "inactive" | "draft">(initialStatus)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isEditingName, setIsEditingName] = React.useState(false)

  const seedNodes = React.useMemo(
    () =>
      initialWorkflow
        ? parseWorkflowNodes(initialWorkflow.nodes)
        : defaultWorkflowCanvasNodes(),
    [initialWorkflow]
  )
  const seedEdges = React.useMemo(
    () => (initialWorkflow ? parseWorkflowEdges(initialWorkflow.edges) : []),
    [initialWorkflow]
  )

  const [graphStr, setGraphStr] = React.useState(() =>
    initialWorkflow
      ? workflowGraphBaseline({
          nodes: parseWorkflowNodes(initialWorkflow.nodes),
          edges: parseWorkflowEdges(initialWorkflow.edges),
        })
      : workflowGraphBaseline({ nodes: defaultWorkflowCanvasNodes(), edges: [] })
  )

  const [baselineName, setBaselineName] = React.useState(initialName.trim())
  const [baselineGraph, setBaselineGraph] = React.useState(graphStr)

  const [leaveDialogOpen, setLeaveDialogOpen] = React.useState(false)
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)

  const isDirty =
    workflowName.trim() !== baselineName.trim() || graphStr !== baselineGraph

  const onGraphChange = React.useCallback((p: { graphBaseline: string }) => {
    setGraphStr(p.graphBaseline)
  }, [])

  React.useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  React.useEffect(() => {
    if (!isDirty) return
    const onDocClickCapture = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]")
      if (!el) return
      const href = el.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (el.hasAttribute("download")) return
      let url: URL
      try {
        url = new URL(href, window.location.origin)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      const next = url.pathname + url.search + url.hash
      if (next === window.location.pathname + window.location.search + window.location.hash) return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(next)
      setLeaveDialogOpen(true)
    }
    document.addEventListener("click", onDocClickCapture, true)
    return () => document.removeEventListener("click", onDocClickCapture, true)
  }, [isDirty])

  function requestLeave(href: string) {
    if (!isDirty) {
      router.push(href)
      return
    }
    setPendingHref(href)
    setLeaveDialogOpen(true)
  }

  function confirmLeave() {
    if (pendingHref) router.push(pendingHref)
    setLeaveDialogOpen(false)
    setPendingHref(null)
  }

  function cancelLeave() {
    setLeaveDialogOpen(false)
    setPendingHref(null)
  }

  /**
   * Persists the current graph and metadata to the API.
   */
  async function handleSave() {
    const graph = canvasRef.current?.getGraph()
    if (!graph) return
    setIsSaving(true)
    try {
      if (isNew) {
        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workflowName,
            description: initialWorkflow?.description ?? null,
            trigger_type: initialWorkflow?.trigger_type ?? "manual",
            trigger_config:
              (initialWorkflow?.trigger_config as Record<string, unknown> | undefined) ?? {},
            nodes: graph.nodes,
            edges: graph.edges,
            status,
          }),
        })
        const json = (await res.json()) as { workflow?: WorkflowRow; error?: string }
        if (!res.ok) {
          window.alert(json.error ?? "Could not create workflow")
          return
        }
        if (!json.workflow) return
        setBaselineName(workflowName.trim())
        setBaselineGraph(workflowGraphBaseline({ nodes: graph.nodes, edges: graph.edges }))
        router.replace(`/workflows/${json.workflow.id}`)
        router.refresh()
        return
      }

      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          nodes: graph.nodes,
          edges: graph.edges,
          status,
        }),
      })
      const json = (await res.json()) as { workflow?: WorkflowRow; error?: string }
      if (!res.ok) {
        window.alert(json.error ?? "Could not save workflow")
        return
      }
      setBaselineName(workflowName.trim())
      setBaselineGraph(workflowGraphBaseline({ nodes: graph.nodes, edges: graph.edges }))
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Unsaved changes: confirm before leaving via in-app links */}
      <Dialog open={leaveDialogOpen} onOpenChange={(o) => !o && cancelLeave()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes to this workflow. If you leave now, those changes will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" onClick={cancelLeave}>
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={confirmLeave}>
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor toolbar */}
      <div className="flex items-center gap-2 border-b px-3 h-11 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Back to workflows"
          onClick={() => requestLeave("/workflows")}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        {/* Editable workflow name */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditingName ? (
            <input
              autoFocus
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
              className="text-sm font-medium bg-transparent border-0 outline-none focus:ring-1 focus:ring-ring rounded px-1.5 py-0.5 min-w-0 w-48"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-sm font-medium px-1.5 py-0.5 rounded hover:bg-accent transition-colors truncate max-w-48"
            >
              {workflowName}
            </button>
          )}

          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0",
              statusConfig[status]
            )}
          >
            {status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            {status}
          </span>
        </div>

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          title="Run history"
        >
          <History className="size-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          onClick={() => void handleSave()}
          disabled={isSaving || (!isDirty && !isNew)}
        >
          <Save className="size-3.5" />
          {isSaving ? "Saving…" : "Save"}
        </Button>

        <Button type="button" size="sm" className="gap-1.5 h-7 text-xs">
          <Play className="size-3.5 fill-current" />
          Run
        </Button>
      </div>

      {/* React Flow canvas — remount when switching between new and persisted id */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas
          key={isNew ? "new" : workflowId}
          ref={canvasRef}
          workflowId={workflowId}
          initialNodes={seedNodes}
          initialEdges={seedEdges}
          onGraphChange={onGraphChange}
        />
      </div>
    </div>
  )
}
