"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
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
import {
  ArrowLeft,
  Play,
  Save,
  History,
  Square,
  MoreHorizontal,
  AlignVerticalJustifyStart,
  ImageDown,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { WorkflowApprovalDialog } from "@/components/workflow/workflow-approval-dialog"
import {
  defaultWorkflowCanvasNodes,
  parseWorkflowEdges,
  parseWorkflowNodes,
  workflowGraphBaseline,
} from "@/lib/workflows/engine/persist"
import type { Database } from "@/types/database"
import type { WorkflowApprovalListRow } from "@/lib/workflows/queries/approval-queries"
import { ManualWorkflowRunDialog } from "@/components/workflow/run-dialog"
import { readInputSchemaFromNodeData, type NodeInputField } from "@/lib/workflows/engine/input-schema"
import { normaliseEntryKind } from "@/lib/workflows/engine/node-type-registry"
import { mergeNodeResult } from "@/lib/workflows/engine/runner"
import type { NodeResult } from "@/lib/workflows/engine/types"
import {
  WorkflowEditorActionsContext,
} from "@/lib/workflows/engine/run-context"
import {
  WORKFLOW_OPEN_RUN_INTENT_VALUE,
  workflowOpenRunIntentStorageKey,
} from "@/lib/workflows/workflow-open-run-intent-storage"
import { normaliseWorkflowConstantsJson } from "@/lib/workflows/workflow-constants"
import { buildWorkflowImageDownloadFileName } from "@/lib/workflows/engine/download-workflow-flow-image"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"]
type WorkflowRunStatus = Database["public"]["Tables"]["workflow_runs"]["Row"]["status"]

type WorkflowLifecycleStatus = "active" | "inactive" | "draft"

interface WorkflowEditorClientProps {
  workflowId: string
  initialWorkflow: WorkflowRow | null
}

const statusConfig: Record<WorkflowLifecycleStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
}

/** Display order and copy for the toolbar lifecycle control. */
const WORKFLOW_LIFECYCLE_OPTIONS: { value: WorkflowLifecycleStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

/**
 * Normalises persisted `node_results` into the editor run-state map keyed by node id.
 */
function mapNodeResultsByNodeId({ nodeResults }: { nodeResults: unknown }): Map<string, NodeResult> {
  if (!Array.isArray(nodeResults)) return new Map()
  const next = new Map<string, NodeResult>()
  for (const item of nodeResults) {
    if (!item || typeof item !== "object") continue
    const row = item as NodeResult
    if (typeof row.node_id !== "string" || row.node_id.trim() === "") continue
    next.set(row.node_id, row)
  }
  return next
}

/**
 * Client workflow editor: toolbar, canvas, save/load via API, and unsaved navigation guard.
 */
export function WorkflowEditorClient({ workflowId, initialWorkflow }: WorkflowEditorClientProps) {
  const router = useRouter()
  const isNew = workflowId === "new"
  const canvasRef = React.useRef<WorkflowCanvasHandle>(null)

  const initialName = initialWorkflow?.name ?? "Untitled workflow"
  const initialStatus = (initialWorkflow?.status ?? "draft") as WorkflowLifecycleStatus

  const [workflowName, setWorkflowName] = React.useState(initialName)
  const [status, setStatus] = React.useState<WorkflowLifecycleStatus>(initialStatus)
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
  const [baselineStatus, setBaselineStatus] = React.useState<WorkflowLifecycleStatus>(initialStatus)

  const [workflowConstants, setWorkflowConstants] = React.useState<Record<string, string>>(() =>
    normaliseWorkflowConstantsJson(initialWorkflow?.workflow_constants),
  )

  React.useEffect(() => {
    setWorkflowConstants(normaliseWorkflowConstantsJson(initialWorkflow?.workflow_constants))
  }, [initialWorkflow?.id])

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
  const [liveRunStatus, setLiveRunStatus] = React.useState<WorkflowRunStatus | null>(null)
  const [approvalDialogOpen, setApprovalDialogOpen] = React.useState(false)
  const [pendingApproval, setPendingApproval] = React.useState<WorkflowApprovalListRow | null>(null)
  const [approvalDialogNodeId, setApprovalDialogNodeId] = React.useState<string | null>(null)
  const [approvalFetchError, setApprovalFetchError] = React.useState<string | null>(null)
  const [approvalFetching, setApprovalFetching] = React.useState(false)
  const [approvalBusy, setApprovalBusy] = React.useState<{ id: string; action: "approved" | "declined" } | null>(null)

  const [layoutBusy, setLayoutBusy] = React.useState(false)

  const [imageExportBusy, setImageExportBusy] = React.useState(false)
  const runHasAwaitingApproval = React.useMemo(
    () => Array.from(runStateMap.values()).some((result) => result.status === "awaiting_approval"),
    [runStateMap],
  )
  const canReviewInlineApproval = runHasAwaitingApproval && liveRunId !== null

  React.useEffect(() => {
    if (!liveRunId) return
    if (
      liveRunStatus !== null &&
      liveRunStatus !== "running" &&
      liveRunStatus !== "waiting_approval"
    ) {
      return
    }

    let cancelled = false

    /**
     * Polls persisted run state so post-approval background resume updates still appear in the editor.
     */
    const pollRun = async () => {
      try {
        const response = await fetch(`/api/run/${liveRunId}`, { cache: "no-store" })
        if (!response.ok || cancelled) return
        const body = (await response.json()) as {
          run?: { status?: WorkflowRunStatus; node_results?: unknown }
        }
        if (cancelled || !body.run) return
        if (typeof body.run.status === "string") {
          setLiveRunStatus(body.run.status)
        }
        setRunStateMap(mapNodeResultsByNodeId({ nodeResults: body.run.node_results }))
      } catch {
        // Keep polling; transient failures should self-recover.
      }
    }

    void pollRun()
    const intervalId = window.setInterval(() => {
      void pollRun()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [liveRunId, liveRunStatus])

  React.useEffect(() => {
    if (!canReviewInlineApproval || !liveRunId) {
      setApprovalDialogOpen(false)
      setApprovalDialogNodeId(null)
      setPendingApproval(null)
      setApprovalFetchError(null)
      setApprovalFetching(false)
      return
    }

    let cancelled = false

    /**
     * Loads the pending approval row for this run so the editor can approve inline while the graph is paused.
     */
    const loadApproval = async () => {
      if (cancelled) return
      setApprovalFetching(true)
      if (approvalDialogOpen) {
        setApprovalFetchError(null)
      }
      try {
        const response = await fetch(
          `/api/approvals?workflow_run_id=${encodeURIComponent(liveRunId)}`,
          { cache: "no-store" },
        )
        const body = (await response.json().catch(() => ({}))) as {
          approvals?: WorkflowApprovalListRow[]
          error?: string
        }
        if (cancelled) return
        if (!response.ok) {
          if (approvalDialogOpen) {
            setApprovalFetchError(typeof body.error === "string" ? body.error : "Could not load approval.")
          }
          setPendingApproval(null)
          return
        }
        const rows = Array.isArray(body.approvals) ? body.approvals : []
        const preferredRow =
          approvalDialogNodeId != null
            ? rows.find((row) => row.node_id === approvalDialogNodeId) ?? null
            : null
        setPendingApproval(preferredRow ?? rows[0] ?? null)
      } finally {
        if (!cancelled) setApprovalFetching(false)
      }
    }

    void loadApproval()
    const intervalId = window.setInterval(() => {
      void loadApproval()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [approvalDialogNodeId, approvalDialogOpen, canReviewInlineApproval, liveRunId])

  const isDirty =
    workflowName.trim() !== baselineName.trim() ||
    graphStr !== baselineGraph ||
    status !== baselineStatus

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

  /**
   * Saves the current workflow and then continues navigation.
   */
  async function saveAndLeave() {
    const ok = await handleSave()
    if (!ok) return
    confirmLeave()
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
        setBaselineStatus(status)
        setWorkflowConstants(normaliseWorkflowConstantsJson(json.workflow.workflow_constants))
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
      setBaselineStatus(status)
      if (json.workflow) {
        setWorkflowConstants(normaliseWorkflowConstantsJson(json.workflow.workflow_constants))
      }
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

  /** True when the visible entry node is configured for invoke (on-demand) runs */
  const isInvokeEntryGraph = React.useCallback(() => {
    const graph = canvasRef.current?.getGraph()
    const entry = graph?.nodes.find((n) => n.type === "entry") ?? null
    if (!entry?.data || typeof entry.data !== "object") return false
    const et = (entry.data as Record<string, unknown>).entryType
    const entryType = typeof et === "string" ? et : undefined
    return normaliseEntryKind({ value: entryType }) === "invoke"
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
    if (!isInvokeEntryGraph()) {
      window.alert("Runs from the toolbar are only available when the entry trigger is Invoke.")
      return
    }
    if (isDirty) {
      setRunSavePromptOpen(true)
      return
    }
    openManualRunForm()
  }, [isDirty, isInvokeEntryGraph, isNew, openManualRunForm])

  /**
   * When the workflows index sets a session flag before routing here, reopen the manual run modal once using the same rules as the toolbar.
   */
  React.useEffect(() => {
    if (isNew) return

    const key = workflowOpenRunIntentStorageKey({ workflowId })
    try {
      if (typeof window.sessionStorage?.getItem !== "function") return
      if (sessionStorage.getItem(key) !== WORKFLOW_OPEN_RUN_INTENT_VALUE) return
      sessionStorage.removeItem(key)
    } catch {
      return
    }

    queueMicrotask(() => {
      openManualRunDialog()
    })
  }, [isNew, workflowId, openManualRunDialog])

  /**
   * Streams a simulated execution from the server and mirrors node status on the canvas.
   * Closes the input dialog immediately so the user can watch the run unfold on the canvas.
   */
  const runWorkflow = React.useCallback(async (p: { inputs: Record<string, unknown> }) => {
    // Close the input dialog straight away so the canvas is visible during the run
    setManualRunOpen(false)
    setManualRunSubmitting(true)
    setLiveRunId(null)
    setLiveRunStatus("running")
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
            setLiveRunStatus("running")
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
      openPendingApprovalDialog: ({ nodeId }: { nodeId?: string } = {}) => {
        if (!canReviewInlineApproval) return
        setApprovalDialogNodeId(typeof nodeId === "string" && nodeId.trim() !== "" ? nodeId : null)
        setApprovalDialogOpen(true)
      },
      canOpenPendingApprovalDialog: canReviewInlineApproval && pendingApproval !== null && approvalBusy === null,
    }),
    [
      openManualRunDialog,
      runWorkflow,
      manualRunSubmitting,
      stopRun,
      canReviewInlineApproval,
      pendingApproval,
      approvalBusy,
    ]
  )

  /** Applies ELK vertical layered layout via the canvas ref (see React Flow elkjs example). */
  const handleCleanLayout = React.useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLayoutBusy(true)
    try {
      await canvas.applyVerticalElkLayout()
    } finally {
      setLayoutBusy(false)
    }
  }, [])

  /** PNG export of the canvas via html-to-image (React Flow download-image pattern). */
  const handleDownloadWorkflowImage = React.useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setImageExportBusy(true)
    try {
      const fileName = buildWorkflowImageDownloadFileName({ name: workflowName })
      await canvas.downloadAsImage({ fileName })
    } finally {
      setImageExportBusy(false)
    }
  }, [workflowName])

  /**
   * Posts an inline approval decision from the workflow editor and then refreshes the run row for newest node states.
   */
  const respondToInlineApproval = React.useCallback(
    async ({ approvalId, decision }: { approvalId: string; decision: "approved" | "declined" }) => {
      setApprovalBusy({ id: approvalId, action: decision })
      setApprovalFetchError(null)
      try {
        const response = await fetch(`/api/approvals/${approvalId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        })
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          setApprovalFetchError(typeof body.error === "string" ? body.error : "Request failed")
          return
        }

        setApprovalDialogOpen(false)
        setPendingApproval(null)
        setLiveRunStatus("running")

        if (!liveRunId) return
        const runResponse = await fetch(`/api/run/${liveRunId}`, { cache: "no-store" })
        if (!runResponse.ok) return
        const runBody = (await runResponse.json()) as {
          run?: { status?: WorkflowRunStatus; node_results?: unknown }
        }
        if (typeof runBody.run?.status === "string") {
          setLiveRunStatus(runBody.run.status)
        }
        setRunStateMap(mapNodeResultsByNodeId({ nodeResults: runBody.run?.node_results }))
      } finally {
        setApprovalBusy(null)
      }
    },
    [liveRunId],
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
            <DialogTitle>Leave workflow editor?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Save and leave this view, or abandon these edits and continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="destructive"
              className="focus-visible:ring-offset-2"
              onClick={confirmLeave}
              disabled={isSaving}
            >
              Save and Abandon
            </Button>
            <Button
              type="button"
              autoFocus
              className="focus-visible:ring-offset-2"
              onClick={() => {
                void saveAndLeave()
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save and Exit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor toolbar */}
      <div className="flex items-center gap-2 border-b px-3 h-11 shrink-0">
        <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />

        <Separator orientation="vertical" className="h-4" />

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

          {/* Lifecycle: draft / active / inactive — persisted with Save */}
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as WorkflowLifecycleStatus)}
          >
            <SelectTrigger
              size="sm"
              id="workflow-lifecycle-status"
              aria-label="Workflow status"
              className={cn(
                "h-7 w-fit min-w-0 shrink-0 gap-1 border-0 px-1.5 py-0 text-xs font-medium shadow-none [&_svg]:size-3",
                statusConfig[status]
              )}
            >
              <span className="inline-flex items-center gap-1">
                {status === "active" && (
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                )}
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent align="start">
              {WORKFLOW_LIFECYCLE_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        {/* Toolbar — workflow settings */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          title="Workflow settings"
          aria-label="Workflow settings"
          disabled={isNew}
          onClick={() => router.push(`/app/workflows/${workflowId}/settings`)}
        >
          <Settings className="size-4" />
        </Button>

        {/* Toolbar — run history */}
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

        {/* Toolbar — overflow (run / stop, clean layout), then save */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="More workflow actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {manualRunSubmitting ? (
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => stopRun()}
              >
                <Square className="size-3.5 fill-current" />
                Stop run
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="gap-2"
                disabled={isNew}
                onClick={() => openManualRunDialog()}
              >
                <Play className="size-3.5 fill-current" />
                Run
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              disabled={isNew || layoutBusy}
              onClick={() => void handleCleanLayout()}
            >
              <AlignVerticalJustifyStart className="size-3.5" />
              {layoutBusy ? "Layout…" : "Clean layout"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              disabled={imageExportBusy}
              onClick={() => void handleDownloadWorkflowImage()}
            >
              <ImageDown className="size-3.5" />
              {imageExportBusy ? "Exporting…" : "Download as image"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="default"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          onClick={() => void handleSave()}
          disabled={isSaving || (!isDirty && !isNew)}
        >
          <Save className="size-3.5" />
          {isSaving ? "Saving…" : "Save"}
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
          runState={runStateMap}
          liveRunId={liveRunId}
          workflowConstants={workflowConstants}
        />
      </div>

      <WorkflowApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={({ open }) => {
          setApprovalDialogOpen(open)
          if (!open) {
            setApprovalDialogNodeId(null)
            setApprovalFetchError(null)
          }
        }}
        approval={pendingApproval}
        isLoading={approvalDialogOpen && approvalFetching && pendingApproval === null && approvalFetchError === null}
        loadError={approvalFetchError}
        busyRow={approvalBusy}
        onRespond={(params) => void respondToInlineApproval(params)}
      />
    </div>
    </WorkflowEditorActionsContext.Provider>
  )
}
