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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Play, Save, History, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  defaultWorkflowCanvasNodes,
  parseWorkflowEdges,
  parseWorkflowNodes,
  workflowGraphBaseline,
} from "@/lib/workflow/persist"
import type { Database } from "@/types/database"
import { ManualWorkflowRunDialog } from "@/components/workflow/run-dialog"
import { readInputSchemaFromNodeData, type NodeInputField } from "@/lib/workflow/input-schema"
import { normaliseEntryKind } from "@/lib/workflow/node-type-registry"
import { mergeNodeResult } from "@/lib/workflow/runner"
import type { NodeResult } from "@/lib/workflow/types"
import {
  WorkflowEditorActionsContext,
} from "@/lib/workflow/run-context"

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

  /** Shown when Run is requested while the graph or name differs from the last saved baseline. */
  const [runSavePromptOpen, setRunSavePromptOpen] = React.useState(false)

  const [manualRunOpen, setManualRunOpen] = React.useState(false)
  const [manualRunFields, setManualRunFields] = React.useState<NodeInputField[]>([])
  /** Bumps whenever the modal opens so draft state resets without effect hooks */
  const [manualRunNonce, setManualRunNonce] = React.useState(0)
  const [manualRunSubmitting, setManualRunSubmitting] = React.useState(false)
  /** Confirmation dialog shown before aborting an in-flight run */
  const [stopConfirmOpen, setStopConfirmOpen] = React.useState(false)
  /** Holds the AbortController for the current streamed run request */
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const [runStateMap, setRunStateMap] = React.useState(() => new Map<string, NodeResult>())
  /** Persisted run row id from the latest streamed execution (for linking step I/O in the editor). */
  const [liveRunId, setLiveRunId] = React.useState<string | null>(null)

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
   *
   * @returns Whether the workflow was saved successfully (false if validation failed or the request errored).
   */
  async function handleSave(): Promise<boolean> {
    const graph = canvasRef.current?.getGraph()
    if (!graph) return false
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
          return false
        }
        if (!json.workflow) return false
        setBaselineName(workflowName.trim())
        setBaselineGraph(workflowGraphBaseline({ nodes: graph.nodes, edges: graph.edges }))
        router.replace(`/app/workflows/${json.workflow.id}`)
        router.refresh()
        return true
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
        return false
      }
      setBaselineName(workflowName.trim())
      setBaselineGraph(workflowGraphBaseline({ nodes: graph.nodes, edges: graph.edges }))
      router.refresh()
      return true
    } finally {
      setIsSaving(false)
    }
  }

  /** Reads the current graph from the canvas so trigger inputs stay in sync with unsaved edits */
  const resolveManualEntryInputFields = React.useCallback(() => {
    const graph = canvasRef.current?.getGraph()
    const entry = graph?.nodes.find((n) => n.type === "entry") ?? null
    if (!entry?.data || typeof entry.data !== "object") {
      return readInputSchemaFromNodeData({ value: [] })
    }
    const raw = (entry.data as Record<string, unknown>).inputSchema
    return readInputSchemaFromNodeData({ value: raw })
  }, [])

  /** True when the visible entry node is configured for manual runs */
  const isManualEntryGraph = React.useCallback(() => {
    const graph = canvasRef.current?.getGraph()
    const entry = graph?.nodes.find((n) => n.type === "entry") ?? null
    if (!entry?.data || typeof entry.data !== "object") return false
    const et = (entry.data as Record<string, unknown>).entryType
    const entryType = typeof et === "string" ? et : undefined
    return normaliseEntryKind({ value: entryType }) === "manual"
  }, [])

  /**
   * Opens the manual-trigger input modal (caller has already validated entry type and persistence).
   */
  const openManualRunForm = React.useCallback(() => {
    setManualRunFields(resolveManualEntryInputFields())
    setManualRunNonce((x) => x + 1)
    setManualRunOpen(true)
  }, [resolveManualEntryInputFields])

  /**
   * Opens the manual trigger form (toolbar or entry node button).
   */
  const openManualRunDialog = React.useCallback(() => {
    if (isNew) {
      window.alert("Save the workflow before running it.")
      return
    }
    if (!isManualEntryGraph()) {
      window.alert("Manual runs are only available when the entry trigger is set to manual.")
      return
    }
    if (isDirty) {
      setRunSavePromptOpen(true)
      return
    }
    openManualRunForm()
  }, [isDirty, isManualEntryGraph, isNew, openManualRunForm])

  /**
   * Streams a simulated execution from the server and mirrors node status on the canvas.
   * Closes the input dialog immediately so the user can watch the run unfold on the canvas.
   */
  const runWorkflow = React.useCallback(async (p: { inputs: Record<string, unknown> }) => {
    // Close the input dialog straight away so the canvas is visible during the run
    setManualRunOpen(false)
    setManualRunSubmitting(true)
    setLiveRunId(null)
    setRunStateMap(new Map())

    const ac = new AbortController()
    abortControllerRef.current = ac

    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: p.inputs }),
        signal: ac.signal,
      })
      if (!res.ok) {
        let message = await res.text()
        try {
          const j = JSON.parse(message) as { error?: string }
          if (j?.error) message = j.error
        } catch {
          /* Plain text payload */
        }
        window.alert(message || "Run request failed")
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        window.alert("No response stream from server.")
        return
      }
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""
        for (const block of parts) {
          const line = block.split("\n").find((l) => l.startsWith("data: "))
          if (!line) continue
          let payload: unknown
          try {
            payload = JSON.parse(line.slice(6)) as unknown
          } catch {
            continue
          }
          if (!payload || typeof payload !== "object") continue
          const rec = payload as Record<string, unknown>
          if (rec.kind === "run" && typeof rec.runId === "string" && rec.runId.trim()) {
            setLiveRunId(rec.runId.trim())
          }
          if (rec.kind === "node_result" && rec.result && typeof rec.result === "object") {
            const result = rec.result as NodeResult
            setRunStateMap((prev) => {
              const next = new Map(prev)
              const existing = next.get(result.node_id)
              next.set(
                result.node_id,
                existing ? mergeNodeResult({ prev: existing, next: result }) : result
              )
              return next
            })
          }
          if (rec.kind === "error" && typeof rec.message === "string") {
            window.alert(rec.message)
          }
        }
      }
    } catch (err) {
      // Ignore abort errors — the user intentionally stopped the run
      if (err instanceof Error && err.name === "AbortError") return
      throw err
    } finally {
      abortControllerRef.current = null
      setManualRunSubmitting(false)
    }
  }, [workflowId])

  /** Requests user confirmation before cancelling the active run. */
  const stopRun = React.useCallback(() => {
    if (!manualRunSubmitting) return
    setStopConfirmOpen(true)
  }, [manualRunSubmitting])

  /** Aborts the in-flight fetch after the user confirms they want to stop. */
  const confirmStopRun = React.useCallback(() => {
    abortControllerRef.current?.abort()
    setStopConfirmOpen(false)
  }, [])

  const editorRunActions = React.useMemo(
    () => ({
      openManualRunDialog,
      runWorkflow,
      isRunning: manualRunSubmitting,
      stopRun,
    }),
    [openManualRunDialog, runWorkflow, manualRunSubmitting, stopRun]
  )

  return (
    <WorkflowEditorActionsContext.Provider value={editorRunActions}>
    <div className="flex flex-col h-full">
      {/* Manual run — streamed execution */}
      <ManualWorkflowRunDialog
        key={manualRunNonce}
        open={manualRunOpen}
        onOpenChange={setManualRunOpen}
        fields={manualRunFields}
        isSubmitting={manualRunSubmitting}
        onRun={async ({ values }) => {
          await runWorkflow({ inputs: values })
        }}
      />

      {/* Unsaved edits: confirm save before opening the manual run form */}
      <Dialog open={runSavePromptOpen} onOpenChange={setRunSavePromptOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Save before running?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Save your workflow first so the run uses your latest graph,
              or cancel to keep editing without running.
            </DialogDescription>
          </DialogHeader>
          {/* Footer actions */}
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRunSavePromptOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() =>
                void (async () => {
                  const ok = await handleSave()
                  if (ok) {
                    setRunSavePromptOpen(false)
                    openManualRunForm()
                  }
                })()
              }
            >
              {isSaving ? "Saving…" : "Save and run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop run — confirm before aborting the in-flight stream */}
      <AlertDialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop this run?</AlertDialogTitle>
            <AlertDialogDescription>
              The workflow is still executing. Stopping it now will abort the current run — any
              steps already completed will not be rolled back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmStopRun}
            >
              Stop run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          onClick={() => requestLeave("/app/workflows")}
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
          aria-label="Run history"
          disabled={isNew}
          onClick={() => router.push(`/app/workflows/${workflowId}/history`)}
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

        {/* Run / Stop button — swaps to destructive Stop while a run is in flight */}
        {manualRunSubmitting ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1.5 h-7 text-xs"
            onClick={() => stopRun()}
          >
            <Square className="size-3.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            disabled={isNew}
            onClick={() => openManualRunDialog()}
          >
            <Play className="size-3.5 fill-current" />
            Run
          </Button>
        )}
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
          runState={runStateMap}
          liveRunId={liveRunId}
        />
      </div>
    </div>
    </WorkflowEditorActionsContext.Provider>
  )
}
