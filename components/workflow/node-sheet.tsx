"use client"

import * as React from "react"
import type { Edge, Node } from "@xyflow/react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDownFromLine, ArrowDownToLine, ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import {
  getWorkflowSheetTypeLabel,
  normaliseAiSubtype,
  normaliseDocumentSubtype,
} from "@/lib/workflows/engine/node-type-registry"
import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"
import type { SwitchBranch } from "@/lib/workflows/steps/logic/switch/node"
import type { SplitPath } from "@/lib/workflows/steps/logic/split/node"
import { ModelSelector } from "@/components/model-selector"
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models"
import { InputSchemaBuilder } from "@/components/workflow/input-schema-builder"
import { WorkflowGateRuleBuilder } from "@/components/workflow/workflow-gate-rule-builder"
import {
  type GateGroup,
  createEmptyGateGroup,
  compileGateGroupToExpression,
  readGateGroupFromNodeData,
} from "@/lib/workflows/engine/gate-rule"
import { SystemPromptField } from "@/components/workflow/system-prompt-field"
import { createEmptyNodeInputField, readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  WORKFLOW_DOCUMENT_TEMPLATE_PROMPT_IMPORT,
  WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT,
  WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT,
  WORKFLOW_STEP_INPUT_PROMPT_IMPORT,
} from "@/lib/workflows/input-schema-from-prompt-flavours"
import {
  mergePromptTagDefinitions,
  generateTextExecutionPromptTags,
  classifyObjectExecutionPromptTags,
  extractObjectExecutionPromptTags,
  numericExeNumberPromptTags,
  approvalExePromptTags,
  webhookCallExePromptTags,
  nodeInputFieldsToPromptTags,
  prevPromptTagsFromPredecessorNode,
  workflowGlobalsPromptTagsFromNodes,
  type PromptTagDefinition,
} from "@/lib/workflows/engine/prompt-tags"
import { ClassifyCatalogueEditor } from "@/components/workflow/classify-catalogue-editor"
import { AI_CLASSIFY_OPTIONAL_GUIDANCE_PLACEHOLDER } from "@/lib/workflows/steps/ai/classify/defaults"
import { ExtractFieldsEditor } from "@/components/workflow/extract-fields-editor"
import { AI_EXTRACT_OPTIONAL_GUIDANCE_PLACEHOLDER } from "@/lib/workflows/steps/ai/extract/defaults"
import { readExtractFieldRowsFromNodeData } from "@/lib/workflows/steps/ai/extract/defaults"
import {
  inferPreviousStepOutputFields,
  listInboundSourcesForNode,
  mergeInputSchemaWithPreviousStepImport,
  replaceInputSchemaWithPreviousStepImport,
} from "@/lib/workflows/engine/previous-step-import"
import {
  mergeEntryOutputSchemaFromInputFields,
  mergeExtractOutputSchemaFromExtractFields,
  mergeOutputSchemaFromExecutionSpecs,
  buildApprovalExecutionImportSpecs,
  buildGenerateTextExecutionImportSpecs,
  buildClassifyExecutionImportSpecs,
  buildNumericStepExecutionImportSpecs,
  WEBHOOK_CALL_EXECUTION_IMPORT_SPECS,
  DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS,
  DOCUMENT_XML_EXECUTION_IMPORT_SPECS,
} from "@/lib/workflows/engine/schema-mapping-merge"
import { FunctionInput } from "@/components/workflow/function-input"
import { WorkflowRunContext } from "@/lib/workflows/engine/run-context"
import { RunStepDetailSheetBody } from "@/components/workflow/run-step-detail-sheet-body"
import { resolveRunStepTimelineLabel } from "@/lib/workflows/engine/run-timeline"
import { DocumentTemplateUploadField } from "@/components/workflow/document-template-upload-field"
import type { WorkflowSchemaImportApplyMode } from "@/components/workflow/workflow-schema-builder-toolbar"

/** Stable lists for output "Import from execution" on generate-text-shaped AI steps (generate / transform / summarise). */
const GENERATE_TEXT_STEP_EXECUTION_IMPORT_SPECS = buildGenerateTextExecutionImportSpecs()

/** Classifier execution field rows for classify output imports. */
const CLASSIFY_STEP_EXECUTION_IMPORT_SPECS = buildClassifyExecutionImportSpecs()

interface NodeSheetProps {
  node: Node | null
  open: boolean
  onClose: () => void
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onDelete: (nodeId: string) => void
  /** Owning workflow id — required for document template uploads (omit on legacy callers). */
  workflowId?: string | null
  /** When set, enables wiring Generate text inputs to upstream step outputs. */
  graphNodes?: Node[]
  graphEdges?: Edge[]
  /**
   * Persisted workflow run id for the latest editor execution stream.
   * Together with {@link WorkflowRunContext}, enables the Run tab for step I/O.
   */
  liveRunId?: string | null
}

/**
 * Resolves the inbound predecessor list and an optional user pick when multiple edges target the same step.
 */
function useInboundPredecessorSelection({
  targetNodeId,
  graphNodes,
  graphEdges,
  disabled,
}: {
  targetNodeId: string
  graphNodes: Node[]
  graphEdges: Edge[]
  disabled: boolean
}) {
  /** Remembers the chosen upstream id per target node when several edges exist. */
  const [pickedInboundByTarget, setPickedInboundByTarget] = React.useState<Record<string, string>>({})

  const setPickedSourceId = React.useCallback(
    (id: string | null | undefined) => {
      if (targetNodeId.length === 0) return
      if (id == null || id === "") return
      setPickedInboundByTarget((prev) => ({ ...prev, [targetNodeId]: id }))
    },
    [targetNodeId],
  )

  const predecessorNodes = React.useMemo(() => {
    if (disabled || targetNodeId.length === 0) return []
    const sourceIds = listInboundSourcesForNode({ edges: graphEdges, targetNodeId })
    return sourceIds
      .map((id) => graphNodes.find((n) => n.id === id))
      .filter((n): n is Node => Boolean(n))
  }, [disabled, graphEdges, graphNodes, targetNodeId])

  const pickedSourceId =
    targetNodeId.length > 0 ? pickedInboundByTarget[targetNodeId] ?? null : null

  const resolvedSourceId = React.useMemo(() => {
    if (predecessorNodes.length === 0) return null
    const ids = predecessorNodes.map((n) => n.id)
    if (pickedSourceId && ids.includes(pickedSourceId)) return pickedSourceId
    return ids[0] ?? null
  }, [pickedSourceId, predecessorNodes])

  const selectedPredecessor = React.useMemo(
    () =>
      resolvedSourceId != null ? predecessorNodes.find((n) => n.id === resolvedSourceId) ?? null : null,
    [predecessorNodes, resolvedSourceId],
  )

  return {
    predecessorNodes,
    pickedSourceId,
    setPickedSourceId,
    resolvedSourceId,
    selectedPredecessor,
  }
}

/**
 * Computes whether the sheet should show Input, Branch, Gate, Execution, and Output tabs for the given node.
 * Tabs are omitted entirely when no secondary sections apply.
 */
function getNodeSheetTabVisibility({
  nodeType,
  aiSubtype,
}: {
  nodeType?: string | null
  aiSubtype?: string | null
}) {
  const entryShowsInputTab = nodeType === "entry"

  const showInput =
    entryShowsInputTab ||
    nodeType === "ai" ||
    nodeType === "code" ||
    nodeType === "random" ||
    nodeType === "iteration" ||
    nodeType === "document" ||
    nodeType === "decision" ||
    nodeType === "switch" ||
    nodeType === "split" ||
    nodeType === "webhookCall" ||
    nodeType === "approval"

  // Step behaviour distinct from inbound payload shaping (instructions, runnable code, numeric increment, etc.).
  const showExecution =
    nodeType === "ai" ||
    nodeType === "code" ||
    nodeType === "random" ||
    nodeType === "iteration" ||
    nodeType === "document"

  /** Invoke, webhook, and schedule triggers all evaluate `outputSchema` / `globalsSchema` via the same entry executor. */
  const entryShowsOutputMapping = nodeType === "entry"

  const aiSubtypeNormalised = nodeType === "ai" ? normaliseAiSubtype({ value: aiSubtype }) : null

  const showAiGenerateOutput = aiSubtypeNormalised === "generate"
  const showAiTransformOutput = aiSubtypeNormalised === "transform"
  const showAiSummarizeOutput = aiSubtypeNormalised === "summarize"
  const showAiClassifyOutput = aiSubtypeNormalised === "classify"
  const showAiExtractOutput = aiSubtypeNormalised === "extract"

  const showNumericComputationOutput = nodeType === "random" || nodeType === "iteration"

  const showWebhookCallOutput = nodeType === "webhookCall"

  const showEndOutput = nodeType === "end"

  const showGate = nodeType === "decision" || nodeType === "switch"

  /** Split-only: parallel outbound handles (no conditions). */
  const showBranchTab = nodeType === "split"

  const showOutput =
    nodeType === "decision" ||
    nodeType === "switch" ||
    nodeType === "split" ||
    nodeType === "document" ||
    entryShowsOutputMapping ||
    showAiGenerateOutput ||
    showAiTransformOutput ||
    showAiSummarizeOutput ||
    showAiClassifyOutput ||
    showAiExtractOutput ||
    showNumericComputationOutput ||
    showWebhookCallOutput ||
    showEndOutput ||
    nodeType === "approval"

  return { showInput, showBranchTab, showGate, showExecution, showOutput }
}

/** Normalises `data.paths` into a mutable list with at least one path. */
function readSplitPaths({ data }: { data: Record<string, unknown> }): SplitPath[] {
  const raw = data.paths
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped = (raw as Partial<SplitPath>[]).map((p) => ({
      id: String(p?.id ?? "").trim(),
      label: p?.label !== undefined ? String(p.label) : "",
    })).filter((p) => p.id.length > 0)
    if (mapped.length > 0) return mapped
  }
  return [{ id: "sp-a", label: "Path A" }]
}

/**
 * Split node — parallel outbound branches (one canvas handle per row; same payload to each).
 */
function SplitBranchConfig({
  data,
  set,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
}) {
  const paths = readSplitPaths({ data })

  function commitPaths({ next }: { next: SplitPath[] }) {
    set("paths", next)
  }

  /** Adds another parallel branch with a fresh stable id for edges. */
  function addBranch() {
    const id = `sp-${crypto.randomUUID().slice(0, 8)}`
    commitPaths({
      next: [...paths, { id, label: `Path ${paths.length + 1}` }],
    })
  }

  /** Updates one branch label while preserving ids. */
  function patchPath({
    index,
    partial,
  }: {
    index: number
    partial: Partial<Pick<SplitPath, "label">>
  }) {
    const next = paths.map((p, i) => (i === index ? { ...p, ...partial } : p))
    commitPaths({ next })
  }

  /** Removes a branch unless only one path would remain. */
  function removeBranch({ index }: { index: number }) {
    if (paths.length <= 1) return
    commitPaths({ next: paths.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      {/* Intro */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Define each outbound branch below. Connect each branch to a different downstream step — every branch receives an identical copy of the inbound execution payload at runtime.
      </p>

      {/* Branch rows */}
      <div className="space-y-3">
        {paths.map((p, idx) => (
          <div key={p.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Branch {idx + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 px-2"
                disabled={paths.length <= 1}
                onClick={() => removeBranch({ index: idx })}
              >
                <Trash2 className="size-3.5" aria-hidden />
                <span className="sr-only">Remove branch</span>
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Branch label</Label>
              <Input
                value={p.label ?? ""}
                onChange={(e) => patchPath({ index: idx, partial: { label: e.target.value } })}
                placeholder={`Branch ${idx + 1}`}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addBranch}>
        <Plus className="size-4" aria-hidden />
        Add branch
      </Button>
    </div>
  )
}

/**
 * Right-hand sheet for workflow nodes: General / Input / Branch (split) / Gate / Execution / Output when applicable,
 * plus **Run** (captured input, output, errors) when this step has data from the latest editor execution.
 */
export function NodeSheet({
  node,
  open,
  onClose,
  onUpdate,
  onDelete,
  workflowId,
  graphNodes = [],
  graphEdges = [],
  liveRunId,
}: NodeSheetProps) {
  const [localData, setLocalData] = React.useState<Record<string, unknown>>({})
  const runMap = React.useContext(WorkflowRunContext)
  /** Active primary tab in the node sheet (includes Run when execution data exists for this node). */
  const [activeSheetTab, setActiveSheetTab] = React.useState<
    "general" | "input" | "branch" | "gate" | "execution" | "output" | "run"
  >("general")

  // Sync local state when the selected node changes
  React.useEffect(() => {
    if (!node) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- draft reset when switching nodes
    setLocalData({ ...node.data })
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Land on General when switching nodes; drop Run if this step no longer has run data. */
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab strip should reset with selected node id
    setActiveSheetTab("general")
  }, [node?.id])

  const inboundPick = useInboundPredecessorSelection({
    targetNodeId: node?.id ?? "",
    graphNodes,
    graphEdges,
    disabled: node == null,
  })

  const upstreamPromptTags = React.useMemo(
    () =>
      prevPromptTagsFromPredecessorNode({
        previousNode: inboundPick.selectedPredecessor,
      }),
    [inboundPick.selectedPredecessor],
  )

  const workflowGlobalPromptTags = React.useMemo(
    () => workflowGlobalsPromptTagsFromNodes({ nodes: graphNodes }),
    [graphNodes],
  )

  const entryNodeForTags = React.useMemo(
    () => graphNodes.find((n) => n.type === "entry") ?? null,
    [graphNodes],
  )

  const entryInvokeInputFieldTags = React.useMemo(
    () =>
      nodeInputFieldsToPromptTags({
        fields: readInputSchemaFromNodeData({
          value:
            entryNodeForTags != null
              ? (entryNodeForTags.data as Record<string, unknown> | undefined)?.inputSchema
              : undefined,
        }),
      }),
    [entryNodeForTags],
  )

  /** Resolved Input tab keys surface as `{{input.<key>}}` in the Approval message. */
  const approvalInputFieldsForMessageTags = React.useMemo(
    () =>
      nodeInputFieldsToPromptTags({
        fields: readInputSchemaFromNodeData({ value: localData.inputSchema }),
      }),
    [localData.inputSchema],
  )

  /** Tag palette for the Approval step’s inbox message (matches downstream step conventions). */
  const approvalMessagePromptTags = React.useMemo(
    () =>
      mergePromptTagDefinitions({
        contextual: [
          ...workflowGlobalPromptTags,
          ...upstreamPromptTags,
          ...entryInvokeInputFieldTags,
          ...approvalInputFieldsForMessageTags,
        ],
      }),
    [
      workflowGlobalPromptTags,
      upstreamPromptTags,
      entryInvokeInputFieldTags,
      approvalInputFieldsForMessageTags,
    ],
  )

  /** Fall back to General when this node no longer has run snapshots (e.g. run map cleared). */
  const showRunTabForEffect = node != null && runMap.has(node.id)
  React.useEffect(() => {
    if (!showRunTabForEffect && activeSheetTab === "run") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid Run tab when snapshot is absent
      setActiveSheetTab("general")
    }
  }, [showRunTabForEffect, activeSheetTab])

  if (!node) return null

  const sheetNode = node

  const sheetTypeLabel = getWorkflowSheetTypeLabel({ type: sheetNode.type })
  const { showInput, showBranchTab, showGate, showExecution, showOutput } = getNodeSheetTabVisibility({
    nodeType: sheetNode.type,
    aiSubtype: sheetNode.type === "ai" ? (localData.subtype as string | undefined) : undefined,
  })
  const useTabs =
    showInput || showBranchTab || showGate || showExecution || showOutput
  const stepRunResult = runMap.get(sheetNode.id)
  const showRunTab = stepRunResult !== undefined
  const useTabStrip = useTabs || showRunTab
  const tabCount =
    1 +
    (showInput ? 1 : 0) +
    (showBranchTab ? 1 : 0) +
    (showGate ? 1 : 0) +
    (showExecution ? 1 : 0) +
    (showOutput ? 1 : 0) +
    (showRunTab ? 1 : 0)

  function set(key: string, value: unknown) {
    setLocalData((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    onUpdate(sheetNode.id, localData)
    onClose()
  }

  /** Applies only recognised sheet tab values from Radix. */
  function handleSheetTabChange(value: string) {
    if (
      value === "general" ||
      value === "input" ||
      value === "branch" ||
      value === "gate" ||
      value === "execution" ||
      value === "output" ||
      value === "run"
    ) {
      setActiveSheetTab(value)
    }
  }

  const persistedRunIdForIo = liveRunId?.trim() ?? ""

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full max-h-[100dvh] min-h-0 w-full flex-col gap-0 p-0 sm:min-w-[600px] sm:max-w-[600px]">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          {/* Large type icon left; title + type tag stacked beside it; vertical centre alignment */}
          <div className="flex min-h-12 items-center gap-4">
            {/* Header tile — same accent + glyph rules as canvas / add sheet */}
            <WorkflowNodeIconTile
              type={sheetNode.type ?? "action"}
              size="lg"
              stroke="emphasis"
              frameClassName="flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm"
              entryType={localData.entryType as string | undefined}
              aiSubtype={localData.subtype as string | undefined}
              documentSubtype={
                sheetNode.type === "document" ? (localData.subtype as string | undefined) : undefined
              }
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
              <SheetTitle className="text-base font-semibold leading-tight m-0 p-0 truncate">
                {String(localData.label ?? "Node")}
              </SheetTitle>
              <Badge variant="secondary" className="w-fit text-xs font-medium leading-none">
                {sheetTypeLabel}
              </Badge>
            </div>
          </div>
          <SheetDescription className="sr-only">Configure node settings</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {useTabStrip ? (
              <Tabs
                value={activeSheetTab}
                onValueChange={handleSheetTabChange}
                className="w-full gap-0"
              >
                {/* Primary tabs — Run appears only when this step has execution data */}
                <TabsList
                  className={cn(
                    "grid h-auto min-h-9 w-full shrink-0 gap-1",
                    tabCount === 1 && "grid-cols-1",
                    tabCount === 2 && "grid-cols-2",
                    tabCount === 3 && "grid-cols-3",
                    tabCount === 4 && "grid-cols-4",
                    tabCount === 5 && "grid-cols-5",
                    tabCount === 6 && "grid-cols-6",
                    tabCount >= 7 && "grid-cols-7",
                  )}
                >
                  <TabsTrigger value="general" className="w-full min-h-8 shrink-0">
                    General
                  </TabsTrigger>
                  {showInput ? (
                    <TabsTrigger value="input" className="w-full min-h-8 shrink-0">
                      Input
                    </TabsTrigger>
                  ) : null}
                  {showBranchTab ? (
                    <TabsTrigger value="branch" className="w-full min-h-8 shrink-0">
                      Branch
                    </TabsTrigger>
                  ) : null}
                  {showGate ? (
                    <TabsTrigger value="gate" className="w-full min-h-8 shrink-0">
                      Conditions
                    </TabsTrigger>
                  ) : null}
                  {showExecution ? (
                    <TabsTrigger value="execution" className="w-full min-h-8 shrink-0">
                      Execution
                    </TabsTrigger>
                  ) : null}
                  {showOutput ? (
                    <TabsTrigger value="output" className="w-full min-h-8 shrink-0">
                      Output
                    </TabsTrigger>
                  ) : null}
                  {showRunTab ? (
                    <TabsTrigger value="run" className="w-full min-h-8 shrink-0">
                      Run
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                {/* General: label & description */}
                <TabsContent value="general" className="mt-4 space-y-3 outline-none">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={String(localData.label ?? "")}
                      onChange={(e) => set("label", e.target.value)}
                      placeholder="Node name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={String(localData.description ?? "")}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="Describe what this step does..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  {/* Approval-only: resolved message surfaces at the top of the Inbox review sheet */}
                  {sheetNode.type === "approval" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="approval-message-fn">Approval message</Label>
                      <FunctionInput
                        id="approval-message-fn"
                        tags={approvalMessagePromptTags}
                        value={String(
                          localData.approvalMessage ??
                            localData.reviewerInstructions ??
                            "",
                        )}
                        onChange={({ value }) =>
                          setLocalData((prev) => {
                            const nextValue = value ?? ""
                            return {
                              ...prev,
                              approvalMessage: nextValue,
                              // Keep legacy key in sync so older approval consumers show the latest message too.
                              reviewerInstructions: nextValue,
                            }
                          })
                        }
                        fieldInstanceId={`${sheetNode.id}-approval-message`}
                        rows={6}
                        expressionDialogTitle="Approval message"
                        expressionDialogDescription={
                          <>
                            Mix copy with workflow tags — for example {"{{prev.*}}"} from the inbound step and fields from
                            the <span className="font-medium text-foreground">Input</span> tab as{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code>
                            {" "}(merged on top of trigger payload), plus {"{{global.*}}"} and {"{{now.*}}"}. Reviewers see
                            the resolved text when the run pauses.
                          </>
                        }
                        placeholder="Explain what reviewers should check. Insert tags from the picker — e.g. {{prev.summary}}."
                        className="bg-background"
                      />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Optional — leave blank when the step label and description are enough on their own.
                      </p>
                    </div>
                  ) : null}
                  {/* Approval — surfaced in inbox; informs editor that execution pauses here */}
                  {sheetNode.type === "approval" ? (
                    <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-3 text-sm text-amber-950 dark:border-amber-900/55 dark:bg-amber-950/25 dark:text-amber-50">
                      <p className="font-medium leading-snug">Human approval checkpoint</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-amber-950/85 dark:text-amber-100/90">
                        When a run reaches this step it pauses until you approve or decline it from Inbox.
                        Downstream nodes run only after approval.
                      </p>
                    </div>
                  ) : null}
                </TabsContent>

                {/* Input: upstream / payload shaping */}
                {showInput ? (
                  <TabsContent value="input" className="mt-4 space-y-4 outline-none">
                    {sheetNode.type === "entry" ? <EntryInputConfig data={localData} set={set} /> : null}
                    {sheetNode.type === "ai" ? (
                      <AiInputConfig
                        data={localData}
                        set={set}
                        inboundPick={inboundPick}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "code" ||
                    sheetNode.type === "random" ||
                    sheetNode.type === "iteration" ||
                    sheetNode.type === "document" ? (
                      <CodeInputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                    {sheetNode.type === "decision" ? (
                      <DecisionInputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                    {sheetNode.type === "switch" ? (
                      <SwitchInputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                    {sheetNode.type === "split" ? (
                      <SplitInputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                    {sheetNode.type === "webhookCall" ? (
                      <WebhookCallInputConfig
                        data={localData}
                        set={set}
                        nodeId={sheetNode.id}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                    {sheetNode.type === "approval" ? (
                      <CodeInputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                  </TabsContent>
                ) : null}

                {showBranchTab ? (
                  <TabsContent value="branch" className="mt-4 space-y-4 outline-none">
                    <SplitBranchConfig data={localData} set={set} />
                  </TabsContent>
                ) : null}

                {showGate ? (
                  <TabsContent value="gate" className="mt-4 space-y-4 outline-none">
                    {sheetNode.type === "decision" ? (
                      <DecisionGateConfig
                        data={localData}
                        set={set}
                        nodeId={sheetNode.id}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "switch" ? (
                      <SwitchGateConfig
                        key={`${sheetNode.id}-switch-conditions`}
                        data={localData}
                        set={set}
                        nodeId={sheetNode.id}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                  </TabsContent>
                ) : null}

                {showExecution ? (
                  <TabsContent value="execution" className="mt-4 space-y-4 outline-none">
                    {sheetNode.type === "ai" ? (
                      <AiExecutionConfig
                        data={localData}
                        set={set}
                        nodeId={sheetNode.id}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "code" ? <CodeExecutionConfig data={localData} set={set} /> : null}
                    {sheetNode.type === "iteration" ? (
                      <IterationIncrementExecutionConfig
                        data={localData}
                        set={set}
                        nodeId={sheetNode.id}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "random" ? (
                      <RandomNumberBoundsExecutionConfig
                        data={localData}
                        set={set}
                        nodeId={sheetNode.id}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        inboundPick={inboundPick}
                      />
                    ) : null}
                    {sheetNode.type === "document" ? (
                      <DocumentExecutionConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        workflowId={workflowId}
                        nodeId={sheetNode.id}
                      />
                    ) : null}
                  </TabsContent>
                ) : null}

                {/* Output: branching */}
                {showOutput ? (
                  <TabsContent value="output" className="mt-4 space-y-4 outline-none">
                    {sheetNode.type === "entry" ? (
                      <EntryTriggerOutputConfig
                        data={localData}
                        set={set}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "ai" &&
                    (normaliseAiSubtype({ value: localData.subtype as string | undefined }) === "generate" ||
                      normaliseAiSubtype({ value: localData.subtype as string | undefined }) === "transform" ||
                      normaliseAiSubtype({ value: localData.subtype as string | undefined }) === "summarize") ? (
                      <AiGenerateOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "ai" &&
                    normaliseAiSubtype({ value: localData.subtype as string | undefined }) === "classify" ? (
                      <AiClassifyOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "ai" &&
                    normaliseAiSubtype({ value: localData.subtype as string | undefined }) === "extract" ? (
                      <AiExtractOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "decision" ? (
                      <DecisionOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "switch" ? (
                      <SwitchOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "split" ? (
                      <SplitOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "random" || sheetNode.type === "iteration" ? (
                      <NumericComputationOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        stepKind={sheetNode.type === "random" ? "random" : "iteration"}
                      />
                    ) : null}
                    {sheetNode.type === "webhookCall" ? (
                      <WebhookCallOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "approval" ? (
                      <ApprovalOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "document" ? (
                      <DocumentOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "end" ? (
                      <EndOutputConfig
                        data={localData}
                        set={set}
                        inboundPick={inboundPick}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                        entryInvokeInputFieldTags={entryInvokeInputFieldTags}
                      />
                    ) : null}
                  </TabsContent>
                ) : null}

                {showRunTab ? (
                  <TabsContent value="run" className="mt-4 outline-none">
                    <div className="-mx-5 min-h-[min(520px,calc(100dvh-220px))] overflow-hidden rounded-lg border border-border/80">
                      <RunStepDetailSheetBody
                        stepLabel={resolveRunStepTimelineLabel(stepRunResult)}
                        result={stepRunResult}
                        runId={persistedRunIdForIo || "—"}
                      />
                    </div>
                  </TabsContent>
                ) : null}
              </Tabs>
            ) : (
              <div className="space-y-5">
                {/* Single-column mode: general fields only */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={String(localData.label ?? "")}
                      onChange={(e) => set("label", e.target.value)}
                      placeholder="Node name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={String(localData.description ?? "")}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="Describe what this step does..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center gap-2 border-t px-5 py-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                onDelete(sheetNode.id)
                onClose()
              }}
            >
              <Trash2 className="size-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Declared outbound fields for Generate text AI steps; mapping cells resolve against `{{exe.*}}` execution outputs. */
function AiGenerateOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const contextualPromptTags = React.useMemo(() => {
    const inputFieldsForTags = readInputSchemaFromNodeData({ value: data.inputSchema })
    return [...generateTextExecutionPromptTags(), ...nodeInputFieldsToPromptTags({ fields: inputFieldsForTags })]
  }, [data.inputSchema])

  /** Same tag palette as the Output schema row (prev, exe, Input tab, now) plus declared `global.*` and output keys as `input.*`. */
  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canSyncFromInput = inputSchemaFields.length > 0

  const aiGenerateOutputConfirmables = React.useMemo(
    () => [
      {
        id: "import_execution",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        alertTitle: "Import output fields from execution?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Adds or refreshes rows for generate-text execution fields (model output, usage, and related metadata). Blank
            mapping cells receive <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{exe.*}}"}</code>{" "}
            placeholders; filled cells stay unless you clear them first (when using append).
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeOutputSchemaFromExecutionSpecs({
              existingOutputFields: base,
              specs: GENERATE_TEXT_STEP_EXECUTION_IMPORT_SPECS,
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output fields from the input schema?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors Input tab rows into the output list with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
            Rows that already have a mapping value stay as they are when using append.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Maps declared outbound keys to expressions — defaults reference AI SDK execution fields */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={aiGenerateOutputConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/** Declared outbound fields for Classify AI steps; mapping cells resolve against classifier `{{exe.classifier_*}}` fields. */
function AiClassifyOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const contextualPromptTags = React.useMemo(() => {
    const inputFieldsForTags = readInputSchemaFromNodeData({ value: data.inputSchema })
    return [...classifyObjectExecutionPromptTags(), ...nodeInputFieldsToPromptTags({ fields: inputFieldsForTags })]
  }, [data.inputSchema])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canSyncFromInput = inputSchemaFields.length > 0

  const aiClassifyOutputConfirmables = React.useMemo(
    () => [
      {
        id: "import_execution",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        alertTitle: "Import output fields from execution?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Adds or refreshes rows for classifier execution fields (label, confidence, reasoning, and usage metadata).
            Blank mapping cells receive{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{exe.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeOutputSchemaFromExecutionSpecs({
              existingOutputFields: base,
              specs: CLASSIFY_STEP_EXECUTION_IMPORT_SPECS,
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output fields from the input schema?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors Input tab rows into the output list with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Maps declared outbound keys to expressions — defaults reference structured classifier execution fields */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={aiClassifyOutputConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/**
 * Outbound mappings for Extract steps — one `{{exe.<key>}}` tag is available per declared extraction field.
 * Includes a "Sync from extraction fields" button that mirrors the Execution-tab field list into output rows.
 */
function AiExtractOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const extractFields = readExtractFieldRowsFromNodeData({ value: data.extractFields })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const contextualPromptTags = React.useMemo(() => {
    const inputFieldsForTags = readInputSchemaFromNodeData({ value: data.inputSchema })
    return [
      ...extractObjectExecutionPromptTags({ fields: extractFields }),
      ...nodeInputFieldsToPromptTags({ fields: inputFieldsForTags }),
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.inputSchema, data.extractFields])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canSyncFromFields = extractFields.length > 0
  const canSyncFromInput = inputSchemaFields.length > 0

  /** Primary: execution field list; secondary: input schema mirror. */
  const extractOutputConfirmables = React.useMemo(
    () => [
      {
        id: "sync_extract_fields",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        disabled: !canSyncFromFields,
        alertTitle: "Import output from extraction fields?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Merges your Execution-tab extraction fields into the output schema. Each field gets a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{exe.<key>}}"}</code> mapping by
            default. Extra output-only rows stay at the end when using append.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeExtractOutputSchemaFromExtractFields({
              existingOutputFields: base,
              extractFields,
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output fields from the input schema?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors Input tab rows into the output list with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromFields, canSyncFromInput, extractFields, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Keep extraction field names aligned with outbound rows — use{" "}
        <span className="font-medium text-foreground">Import from execution</span> or{" "}
        <span className="font-medium text-foreground">Import from input schema</span> on the Output schema header, or{" "}
        <span className="font-medium text-foreground">Import from prompt</span> from the menu. Blank mapping cells
        typically receive{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"{{exe.<key>}}"}</code> placeholders.
      </p>

      {/* Maps declared outbound keys to expressions — defaults reference structured extract execution fields */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={extractOutputConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/**
 * End node: public workflow result for assistant invoke tools — map only the keys you want exposed;
 * `success` is always added at runtime and must not be declared here.
 */
function EndOutputConfig({
  data,
  set,
  inboundPick,
  upstreamPromptTags,
  workflowGlobalPromptTags,
  entryInvokeInputFieldTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
  entryInvokeInputFieldTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })

  const contextualPromptTags = React.useMemo(
    () => [...entryInvokeInputFieldTags, ...workflowGlobalPromptTags],
    [entryInvokeInputFieldTags, workflowGlobalPromptTags],
  )

  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0

  function applyPreviousOutputImport(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.outputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("outputSchema", next)
  }

  const canImport = hasUpstream && selectedPredecessor != null

  return (
    <div className="space-y-4">
      {/* How this node relates to assistant tools and filtered payloads */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Each row becomes a key on the published result object. Use{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{prev.*}}"}</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code>, and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{global.*}}"}</code>{" "}
        references to include only the fields downstream callers should see. The{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">success</code> property is
        always set when this End step runs — you do not need a row for it.
      </p>

      {/* Upstream shape → output rows with {{prev.*}} placeholders */}
      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>

          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground leading-relaxed">
            Use <span className="font-medium text-foreground">Import from previous output</span> or{" "}
            <span className="font-medium text-foreground">Import from prompt</span> on the Output schema header.
            Populated mapping cells remain unless you clear them first (when using append).
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect an upstream step to this End node to enable import shortcuts on the Output schema header.
        </p>
      )}

      {/* Declared keys → expression cells */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_output",
                  label: "Import from previous output",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import output fields from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders from the selected predecessor's published output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import fields",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousOutputImport(params),
                },
              ]
            : undefined
        }
        promptImport={hasUpstream ? WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT : null}
      />
    </div>
  )
}

/** Outbound mappings for Random number / Iteration steps — template cells resolve `{{exe.number}}`. */
function NumericComputationOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
  stepKind,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
  stepKind: "random" | "iteration"
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const contextualPromptTags = React.useMemo(() => {
    const inputFieldsForTags = readInputSchemaFromNodeData({ value: data.inputSchema })
    return [...numericExeNumberPromptTags(), ...nodeInputFieldsToPromptTags({ fields: inputFieldsForTags })]
  }, [data.inputSchema])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const numericExecutionSpecs = React.useMemo(
    () =>
      buildNumericStepExecutionImportSpecs({
        resultKey: stepKind === "random" ? "random_number" : "number",
        resultLabel: stepKind === "random" ? "Random number" : "Number",
      }),
    [stepKind],
  )

  const canSyncFromInput = inputSchemaFields.length > 0

  const numericOutputConfirmables = React.useMemo(
    () => [
      {
        id: "import_execution",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        alertTitle: "Import output fields from execution?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Adds or refreshes the numeric result row bound to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{exe.number}}"}</code>.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeOutputSchemaFromExecutionSpecs({
              existingOutputFields: base,
              specs: numericExecutionSpecs,
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output fields from the input schema?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors Input tab rows into the output list with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromInput, inputSchemaFields, numericExecutionSpecs, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Step outputs keyed for {{prev.*}} on downstream inbound mapping */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={numericOutputConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/** HTTP methods that expose a request body editor. */
const WEBHOOK_BODY_METHODS = new Set(["POST", "PUT", "PATCH"])

/** Valid HTTP methods for the webhook call step. */
const WEBHOOK_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

/**
 * Input configuration for a Webhook step — method selector, URL function input, and optional body template.
 */
function WebhookCallInputConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
  inboundPick,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })
  const method = typeof data.method === "string" ? data.method.toUpperCase() : "POST"
  const showBody = WEBHOOK_BODY_METHODS.has(method)

  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0
  const canImport = hasUpstream && selectedPredecessor != null

  function applyPreviousStepMappings(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  const promptTags = React.useMemo(
    () =>
      mergePromptTagDefinitions({
        contextual: [
          ...workflowGlobalPromptTags,
          ...upstreamPromptTags,
          ...nodeInputFieldsToPromptTags({ fields: inputSchemaFields }),
        ],
      }),
    [workflowGlobalPromptTags, upstreamPromptTags, inputSchemaFields],
  )

  return (
    <div className="space-y-6">
      {/* Request configuration */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Request</p>

        {/* Method selector */}
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => set("method", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBHOOK_HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* URL — function input so tag variables resolve at runtime */}
        <div className="space-y-1.5">
          <Label>URL</Label>
          <FunctionInput
            tags={promptTags}
            value={typeof data.url === "string" ? data.url : ""}
            onChange={({ value }) => set("url", value)}
            fieldInstanceId={`${nodeId}-webhook-url`}
            rows={3}
            expressionDialogTitle="URL expression"
            expressionDialogDescription={
              <>
                The destination URL for this request. Use{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{`{{prev.*}}`}</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{`{{input.*}}`}</code>, and other
                tags to build the URL dynamically.
              </>
            }
          />
        </div>

        {/* Body template — only shown for methods that support a request body */}
        {showBody ? (
          <div className="space-y-1.5">
            <Label>Body</Label>
            <FunctionInput
              tags={promptTags}
              value={typeof data.bodyTemplate === "string" ? data.bodyTemplate : ""}
              onChange={({ value }) => set("bodyTemplate", value)}
              fieldInstanceId={`${nodeId}-webhook-body`}
              rows={7}
              expressionDialogTitle="Request body"
              expressionDialogDescription={
                <>
                  JSON body sent with the request. Use tag variables such as{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{`{{prev.*}}`}</code> to
                  inject dynamic values. The body is sent with{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">Content-Type: application/json</code>
                  .
                </>
              }
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sent with <code className="font-mono text-[11px]">Content-Type: application/json</code>. Leave blank to
              send no body.
            </p>
          </div>
        ) : null}
      </div>

      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>
          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}

      <Separator />

      {/* Standard input field mapping */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_step",
                  label: "Import from previous step",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import mappings from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders that read the inbound step's output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import mappings",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousStepMappings(params),
                },
              ]
            : undefined
        }
        promptImport={hasUpstream ? WORKFLOW_STEP_INPUT_PROMPT_IMPORT : null}
      />
    </div>
  )
}

/** Outbound mappings for Webhook steps — template cells resolve against `{{exe.status_code}}` and `{{exe.ok}}`. */
function WebhookCallOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const contextualPromptTags = React.useMemo(() => {
    const inputFieldsForTags = readInputSchemaFromNodeData({ value: data.inputSchema })
    return [...webhookCallExePromptTags(), ...nodeInputFieldsToPromptTags({ fields: inputFieldsForTags })]
  }, [data.inputSchema])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canSyncFromInput = inputSchemaFields.length > 0

  const webhookOutputConfirmables = React.useMemo(
    () => [
      {
        id: "import_execution",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        alertTitle: "Import output fields from execution?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Adds or refreshes rows for HTTP status and success flag from the webhook runner.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeOutputSchemaFromExecutionSpecs({
              existingOutputFields: base,
              specs: WEBHOOK_CALL_EXECUTION_IMPORT_SPECS,
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output fields from the input schema?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors Input tab rows into the output list with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Informational callout about available exe.* tags */}
      <div className="rounded-lg border border-blue-200/80 bg-blue-50/80 px-3 py-3 text-sm text-blue-950 dark:border-blue-900/55 dark:bg-blue-950/25 dark:text-blue-50">
        <p className="font-medium leading-snug">Available execution variables</p>
        <p className="mt-1.5 text-xs leading-relaxed text-blue-950/85 dark:text-blue-100/90">
          Use{" "}
          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[11px] dark:bg-blue-900/50">
            {`{{exe.status_code}}`}
          </code>{" "}
          to capture the HTTP response code, and{" "}
          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[11px] dark:bg-blue-900/50">
            {`{{exe.ok}}`}
          </code>{" "}
          for a boolean indicating a 2xx response.
        </p>
      </div>

      {/* Step outputs keyed for {{prev.*}} on downstream inbound mapping */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={webhookOutputConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />

      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/**
 * Maps approval step outputs emitted only after an inbox reviewer approves — exposes `exe.*` and optional globals.
 */
function ApprovalOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const contextualPromptTags = React.useMemo(() => {
    const inputFieldsForTags = readInputSchemaFromNodeData({ value: data.inputSchema })
    return [...approvalExePromptTags(), ...nodeInputFieldsToPromptTags({ fields: inputFieldsForTags })]
  }, [data.inputSchema])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canSyncFromInput = inputSchemaFields.length > 0

  const approvalOutputConfirmables = React.useMemo(
    () => [
      {
        id: "import_execution",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        alertTitle: "Import fields from reviewer metadata?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Adds placeholders for{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{exe.decision}}"}</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{exe.responded_at}}"}</code> after a
            successful review.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeOutputSchemaFromExecutionSpecs({
              existingOutputFields: base,
              specs: buildApprovalExecutionImportSpecs(),
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output rows from the Input tab?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors declared input keys with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* How approval outputs behave at runtime */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Downstream steps read this mapping only after someone approves in Inbox — use{" "}
        <span className="font-medium text-foreground">{"{{input.*}}"}</span> for fields from the Input tab,
        {" "}
        <span className="font-medium text-foreground">{"{{exe.*}}"}</span> for reviewer timestamps and decision strings,
        and the usual {"{{prev.*}}"} / {"{{global.*}}"} references.
      </p>

      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={approvalOutputConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />

      {/* Optional globals — merged onto the envelope for later steps */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/**
 * Execution controls for an Iteration step — the increment resolves after `input.*` and other envelope tags.
 */
function IterationIncrementExecutionConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const promptTags = React.useMemo(() => {
    const fields = readInputSchemaFromNodeData({ value: data.inputSchema })
    return mergePromptTagDefinitions({
      contextual: [
        ...workflowGlobalPromptTags,
        ...upstreamPromptTags,
        ...nodeInputFieldsToPromptTags({ fields }),
      ],
    })
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Increment</p>
      {/* Expression added to Starting number after tags resolve */}
      <FunctionInput
        tags={promptTags}
        value={String(data.iterationIncrement ?? "1")}
        onChange={({ value }) => set("iterationIncrement", value)}
        fieldInstanceId={`${nodeId}-iteration-increment`}
        rows={5}
        expressionDialogTitle="Increment expression"
        expressionDialogDescription={
          <>
            Resolve this to a number added to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">starting_number</code> after the
            Input tab resolves — use literals, {"{{prev.*}}"}, {"{{input.*}}"}, workflow {"{{global.*}}"}, and{" "}
            {"{{now.*}}"}.
          </>
        }
      />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Blank drafts save as-is; omitted or non‑numeric resolves fall back to 1 at runtime.
      </p>
    </div>
  )
}

/**
 * Execution controls for a Random number step — both bounds are required and resolved at runtime from tag-aware expressions.
 */
function RandomNumberBoundsExecutionConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
  inboundPick,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
}) {
  const { predecessorNodes, setPickedSourceId } = inboundPick
  const hasUpstream = predecessorNodes.length > 0

  const promptTags = React.useMemo(() => {
    const fields = readInputSchemaFromNodeData({ value: data.inputSchema })
    return mergePromptTagDefinitions({
      contextual: [
        ...workflowGlobalPromptTags,
        ...upstreamPromptTags,
        ...nodeInputFieldsToPromptTags({ fields }),
      ],
    })
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  return (
    <div className="space-y-5">
      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>
          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Use <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{prev.*}}"}</code> tags for
            this selected predecessor when composing min/max expressions.
          </p>
        </div>
      ) : null}

      {/* Lower bound expression */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum</p>
        <FunctionInput
          tags={promptTags}
          value={String(data.randomMinExpression ?? "0")}
          onChange={({ value }) => set("randomMinExpression", value)}
          fieldInstanceId={`${nodeId}-random-min`}
          rows={1}
          expressionDialogTitle="Minimum bound expression"
          expressionDialogDescription={
            <>
              Resolve this to a finite number for the inclusive lower bound. Use literals, {"{{prev.*}}"}, {"{{input.*}}"},
              workflow {"{{global.*}}"}, and {"{{now.*}}"} tags as needed.
            </>
          }
        />
      </div>

      {/* Upper bound expression */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Maximum</p>
        <FunctionInput
          tags={promptTags}
          value={String(data.randomMaxExpression ?? "100")}
          onChange={({ value }) => set("randomMaxExpression", value)}
          fieldInstanceId={`${nodeId}-random-max`}
          rows={1}
          expressionDialogTitle="Maximum bound expression"
          expressionDialogDescription={
            <>
              Resolve this to a finite number for the inclusive upper bound. Use literals, {"{{prev.*}}"}, {"{{input.*}}"},
              workflow {"{{global.*}}"}, and {"{{now.*}}"} tags as needed.
            </>
          }
        />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Both bounds are required. If either expression resolves blank or non-numeric, execution fails with a validation
        error.
      </p>
    </div>
  )
}

/**
 * Entry triggers (invoke, webhook, schedule): maps the trigger envelope into named outputs and optional workflow globals.
 */
function EntryTriggerOutputConfig({
  data,
  set,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  /** Match the entry output row tag palette: Input tab, output keys, declared `global.*`, and `now.*` (via merge inside the editor). */
  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: inputSchemaFields }),
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
    ],
    [workflowGlobalPromptTags, inputSchemaFields, outputSchemaFields],
  )

  const canSyncFromPayload = inputSchemaFields.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payload parity</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Keep outbound keys aligned with what you collect on the Input tab so later steps consume the same names.
          Use <span className="font-medium text-foreground">Import from input schema</span> on the Output schema header
          when you want to merge declaration rows. Clearing a mapped value beforehand lets another import hydrate it
          again.
        </p>
        {!canSyncFromPayload ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add at least one field on the Input tab before importing from the Output schema header.
          </p>
        ) : null}
      </div>

      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        confirmableImports={[
          {
            id: "sync_input",
            label: "Import from input schema",
            TriggerIcon: ArrowDownFromLine,
            disabled: !canSyncFromPayload,
            alertTitle: "Import output from input schema?",
            alertDescription: (
              <span className="text-pretty leading-relaxed">
                This merges input rows into output: labels, types, and required flags follow your payload declaration.
                Blank mapping values become{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code>{" "}
                placeholders. Rows that already have mapping or default text keep their contents when using append; extra
                output-only rows stay at the end.
              </span>
            ),
            confirmLabel: "Import fields",
            offerApplyModeChoice: true,
            onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
              const base = params?.applyMode === "replace" ? [] : outputSchemaFields
              const next = mergeEntryOutputSchemaFromInputFields({
                existingOutputFields: base,
                inputFields: inputSchemaFields,
              })
              set("outputSchema", next)
            },
          },
        ]}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/** Trigger routing plus declared payload schema for Entry nodes. */
function EntryInputConfig({ data, set }: { data: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const showRoutingFields =
    data.entryType === "webhook" || data.entryType === "schedule"

  return (
    <div className="space-y-6">
      {/* Routing — webhook URL fragment or cron */}
      {showRoutingFields ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trigger routing</p>
          {data.entryType === "webhook" ? (
            <div className="space-y-1.5">
              <Label>Webhook path</Label>
              <Input
                value={String(data.webhookPath ?? "")}
                onChange={(e) => set("webhookPath", e.target.value)}
                placeholder="/webhooks/my-trigger"
                className="font-mono text-sm"
              />
            </div>
          ) : null}
          {data.entryType === "schedule" ? (
            <div className="space-y-1.5">
              <Label>Cron expression</Label>
              <Input
                value={String(data.schedule ?? "")}
                onChange={(e) => set("schedule", e.target.value)}
                placeholder="0 9 * * *"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                For example{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">0 9 * * *</code> runs every
                day at 9am.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showRoutingFields ? <Separator /> : null}

      {/* Payload schema — invoke runs, webhooks, and schedules (no inbound step — import toolbar hidden) */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="trigger"
        promptImport={null}
      />
    </div>
  )
}

/** Declared inbound fields for an AI step; prompts reference these as tags on the Execution tab. */
function AiInputConfig({
  data,
  set,
  inboundPick,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0
  const canImport = hasUpstream && selectedPredecessor != null

  /** Maps declared inputs to placeholder expressions that read the selected upstream step output (after confirmation). */
  function applyPreviousStepMappings(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  return (
    <div className="space-y-6">
      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>

          {/* Multiple inbound edges: choose which upstream output to wire */}
          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground leading-relaxed">
            Use <span className="font-medium text-foreground">Import from previous step</span> or{" "}
            <span className="font-medium text-foreground">Import from prompt</span> on the Input schema header. Empty
            mapping cells ingest upstream references; populated cells remain unless you clear them first.
          </p>
        </div>
      ) : null}

      {/* Declared inputs: typed shape + mapping; referenced in the prompt as {{input.key}} */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="prompt"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={workflowGlobalPromptTags}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_step",
                  label: "Import from previous step",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import mappings from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders that read the inbound step's output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import mappings",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousStepMappings(params),
                },
              ]
            : undefined
        }
        promptImport={hasUpstream ? WORKFLOW_STEP_INPUT_PROMPT_IMPORT : null}
      />
    </div>
  )
}

/**
 * Model and prompt / instruction body for an AI step.
 * Tag autocomplete lists `{{global.*}}` from any node globals schema, inbound `{{prev.*}}`, and `{{input.*}}`.
 */
function AiExecutionConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  // Stable reference unless `inputSchema` or predecessor tags change — avoids remounting Tiptap on every `localData` keystroke.
  const promptTags = React.useMemo(() => {
    const fields = readInputSchemaFromNodeData({ value: data.inputSchema })
    return mergePromptTagDefinitions({
      contextual: [
        ...workflowGlobalPromptTags,
        ...upstreamPromptTags,
        ...nodeInputFieldsToPromptTags({ fields }),
      ],
    })
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  const subtype = normaliseAiSubtype({ value: data.subtype as string | undefined })

  return (
    <div className="w-full space-y-6">
      {/* Model row — full width */}
      <div className="w-full space-y-1.5">
        <Label>Model</Label>
        <ModelSelector
          selectedModelId={String(data.model ?? DEFAULT_MODEL_ID)}
          onModelChange={({ modelId }) => set("model", modelId)}
          modelType="text"
          triggerClassName="w-full max-w-none"
        />
      </div>

      {/* Instruction body — classify / extract / summarize: optional guidance; transform / generate / other: primary instructions */}
      <div className="w-full space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {subtype === "classify" || subtype === "extract" || subtype === "summarize"
            ? "Optional guidance"
            : "Instructions"}
        </p>
        {subtype === "classify" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            How to categorise is enforced by this step (exactly one catalogue label, verbatim match, reasoning, and
            confidence). Use this field only for extra domain context; it is sent as supplementary notes and cannot
            override those rules.
          </p>
        ) : null}
        {subtype === "extract" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            How to extract is enforced by this step (the field list, types, required/optional rules, and output
            discipline). Use this field only for extra domain context or formatting hints; it is sent as supplementary
            notes and cannot override those rules.
          </p>
        ) : null}
        {subtype === "summarize" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Core summarisation behaviour is enforced by this step. Use this field to add format, length, or focus
            hints (e.g. &quot;Bullet points, max 5 items&quot;); these notes are appended as supplementary guidance
            and cannot override the primary task.
          </p>
        ) : null}
        {subtype === "transform" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Describe how the source content should be rewritten or restructured. Be specific about the desired output
            format, tone, and any rules to apply — this is the primary instruction the model follows.
          </p>
        ) : null}
        <SystemPromptField
          tags={promptTags}
          value={String(data.prompt ?? "")}
          onChange={({ value }) => set("prompt", value)}
          fieldInstanceId={nodeId}
          rows={subtype === "classify" || subtype === "extract" || subtype === "summarize" ? 6 : 14}
          placeholder={
            subtype === "classify"
              ? AI_CLASSIFY_OPTIONAL_GUIDANCE_PLACEHOLDER
              : subtype === "extract"
                ? AI_EXTRACT_OPTIONAL_GUIDANCE_PLACEHOLDER
                : subtype === "summarize"
                  ? "Optional: specify format, length, or focus — e.g. 'Bullet points, no more than 5 items, formal tone.'"
                  : subtype === "transform"
                    ? "Describe the transformation — e.g. 'Rewrite as a formal email' or 'Convert the JSON fields to snake_case keys.'"
                    : undefined
          }
          helperText={
            subtype === "classify" || subtype === "extract" || subtype === "summarize"
              ? "Optional. Type {{ to insert {{prev.*}} , {{input.*}} , {{global.*}} , and {{now.*}} ."
              : "Type {{ to pick inbound {{prev.*}} from the wired predecessor, {{input.*}} from the Input tab, workflow {{global.*}} keys declared on any step, and {{now.*}}."
          }
          expressionDialogTitle={
            subtype === "classify" || subtype === "extract" || subtype === "summarize"
              ? "Optional guidance"
              : "Instructions"
          }
          expressionDialogDescription={
            subtype === "classify"
              ? "Supplementary notes for the classifier. The runner supplies the main categorisation task and catalogue rules in the system prompt."
              : subtype === "extract"
                ? "Supplementary notes for the extractor. The runner supplies the primary task, field list, and output discipline in the system prompt."
                : subtype === "summarize"
                  ? "Optional format, length, or focus hints. The runner supplies the primary summarisation task and output discipline in the system prompt."
                  : "Insert {{prev.*}} from the inbound step, {{input.*}} from the Input tab, {{global.*}} from Workflow globals on any step, and built-in {{now.*}} timestamps."
          }
        />
      </div>

      {subtype === "classify" ? (
        <>
          {/* Primary payload: optional expression overrides Input-tab JSON for what gets classified */}
          <div className="w-full space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content to classify</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When this field is non-empty, the resolved value is what the model categorises (valid JSON is
              pretty-printed; otherwise it is sent as plain text). Leave blank to use the mapped object from the Input
              tab as JSON.
            </p>
            <FunctionInput
              tags={promptTags}
              value={String(data.classifyContentExpression ?? "")}
              onChange={({ value }) => set("classifyContentExpression", value)}
              fieldInstanceId={`${nodeId}-classify-content`}
              rows={6}
              placeholder="{{prev.text}} or literals — combine with {{input.*}} as needed"
              expressionDialogTitle="Content to classify"
              expressionDialogDescription={
                "Becomes the classifier user payload when the template is non-empty after tag resolution. Use {{prev.*}} from the inbound step, {{input.*}} from the Input tab, {{global.*}} , and {{now.*}} . Leave blank to use the Input tab JSON object only."
              }
            />
          </div>

          <ClassifyCatalogueEditor data={data} set={set} nodeId={nodeId} promptTags={promptTags} />
        </>
      ) : null}

      {subtype === "extract" ? (
        <>
          {/* Content source: optional expression overrides Input-tab JSON for what gets extracted */}
          <div className="w-full space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content to extract from</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When this field is non-empty, the resolved value is the text the model extracts from (valid JSON is
              pretty-printed; otherwise it is sent as plain text). Leave blank to use the mapped object from the Input
              tab as JSON.
            </p>
            <FunctionInput
              tags={promptTags}
              value={String(data.extractContentExpression ?? "")}
              onChange={({ value }) => set("extractContentExpression", value)}
              fieldInstanceId={`${nodeId}-extract-content`}
              rows={6}
              placeholder="{{prev.text}} or literals — combine with {{input.*}} as needed"
              expressionDialogTitle="Content to extract from"
              expressionDialogDescription={
                "Becomes the extractor user payload when the template is non-empty after tag resolution. Use {{prev.*}} from the inbound step, {{input.*}} from the Input tab, {{global.*}} , and {{now.*}} . Leave blank to use the Input tab JSON object only."
              }
            />
          </div>

          {/* Field list editor — each row compiles to a Zod property in the dynamic schema */}
          <ExtractFieldsEditor data={data} set={set} nodeId={nodeId} />
        </>
      ) : null}

      {subtype === "transform" ? (
        <div className="w-full space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content to transform</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When this field is non-empty, the resolved value is what the model transforms (valid JSON is
            pretty-printed; otherwise it is sent as plain text). Leave blank to use the mapped object from the Input
            tab as JSON.
          </p>
          <FunctionInput
            tags={promptTags}
            value={String(data.transformContentExpression ?? "")}
            onChange={({ value }) => set("transformContentExpression", value)}
            fieldInstanceId={`${nodeId}-transform-content`}
            rows={6}
            placeholder="{{prev.text}} or literals — combine with {{input.*}} as needed"
            expressionDialogTitle="Content to transform"
            expressionDialogDescription="Becomes the transformation source payload when the template is non-empty after tag resolution. Use {{prev.*}} from the inbound step, {{input.*}} from the Input tab, {{global.*}} , and {{now.*}} . Leave blank to use the Input tab JSON object only."
          />
        </div>
      ) : null}

      {subtype === "summarize" ? (
        <div className="w-full space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content to summarise</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When this field is non-empty, the resolved value is what the model summarises (valid JSON is
            pretty-printed; otherwise it is sent as plain text). Leave blank to use the mapped object from the Input
            tab as JSON.
          </p>
          <FunctionInput
            tags={promptTags}
            value={String(data.summarizeContentExpression ?? "")}
            onChange={({ value }) => set("summarizeContentExpression", value)}
            fieldInstanceId={`${nodeId}-summarize-content`}
            rows={6}
            placeholder="{{prev.text}} or literals — combine with {{input.*}} as needed"
            expressionDialogTitle="Content to summarise"
            expressionDialogDescription="Becomes the summarisation source payload when the template is non-empty after tag resolution. Use {{prev.*}} from the inbound step, {{input.*}} from the Input tab, {{global.*}} , and {{now.*}} . Leave blank to use the Input tab JSON object only."
          />
        </div>
      ) : null}
    </div>
  )
}

/** Expected step inputs for a code, document, random, or iteration node; runnable source or templates live on the Execution tab. */
function CodeInputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
  inboundPick,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })
  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0
  const canImport = hasUpstream && selectedPredecessor != null

  function applyPreviousStepMappings(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  return (
    <div className="space-y-6">
      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>
          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Expected step inputs; same schema model as AI steps for a consistent experience */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={workflowGlobalPromptTags}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_step",
                  label: "Import from previous step",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import mappings from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders that read the inbound step's output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import mappings",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousStepMappings(params),
                },
              ]
            : undefined
        }
        promptImport={hasUpstream ? WORKFLOW_STEP_INPUT_PROMPT_IMPORT : null}
      />
    </div>
  )
}

/** Language and runnable source for a code step (`input` is shaped on the Input tab). */
function CodeExecutionConfig({
  data,
  set,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code</p>
      {/* Language */}
      <div className="space-y-1.5">
        <Label>Language</Label>
        <Select value={String(data.language ?? "typescript")} onValueChange={(v) => set("language", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="typescript">TypeScript</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
            <SelectItem value="python">Python</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Runnable body */}
      <div className="space-y-1.5">
        <Label>Code</Label>
        <Textarea
          value={String(
            data.code ??
              "// Access previous step output via `input`\nexport default async function run(input) {\n  return input\n}"
          )}
          onChange={(e) => set("code", e.target.value)}
          rows={14}
          className="resize-none font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">Runs in an isolated Vercel Sandbox</p>
      </div>
    </div>
  )
}

/**
 * DocXML execution panel — model instructions produce XML that the runner renders into a Word document.
 */
function DocumentXmlExecutionConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const promptTags = React.useMemo(() => {
    const fields = readInputSchemaFromNodeData({ value: data.inputSchema })
    return mergePromptTagDefinitions({
      contextual: [
        ...workflowGlobalPromptTags,
        ...upstreamPromptTags,
        ...nodeInputFieldsToPromptTags({ fields }),
      ],
    })
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  const outputFileNamePromptTags = React.useMemo(() => {
    const fields = readInputSchemaFromNodeData({ value: data.inputSchema })
    return mergePromptTagDefinitions({
      contextual: [
        ...workflowGlobalPromptTags,
        ...upstreamPromptTags,
        ...nodeInputFieldsToPromptTags({ fields }),
      ],
    })
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  return (
    <div className="w-full space-y-6">
      {/* Model selection */}
      <div className="w-full space-y-1.5">
        <Label>Model</Label>
        <ModelSelector
          selectedModelId={String(data.model ?? DEFAULT_MODEL_ID)}
          onModelChange={({ modelId }) => set("model", modelId)}
          modelType="text"
          triggerClassName="w-full max-w-none"
        />
      </div>

      {/* Prompt body */}
      <div className="w-full space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instructions</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Output becomes XML that we render through{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/wvbe/docxml"
            rel="noreferrer"
            target="_blank"
          >
            docxml
          </a>
          . Review{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/wvbe/docxml/wiki/Get-started"
            rel="noreferrer"
            target="_blank"
          >
            Get started
          </a>
          ,{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/wvbe/docxml/wiki/Examples"
            rel="noreferrer"
            target="_blank"
          >
            Examples
          </a>
          , and{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/wvbe/docxml/wiki/Formatting"
            rel="noreferrer"
            target="_blank"
          >
            Formatting
          </a>{" "}
          for supported constructs.
        </p>
        <SystemPromptField
          tags={promptTags}
          value={String(data.prompt ?? "")}
          onChange={({ value }) => set("prompt", value)}
          fieldInstanceId={`${nodeId}-document-xml-prompt`}
          rows={14}
          helperText="Type {{ to insert {{prev.*}} , {{input.*}} , {{global.*}} , and {{now.*}} . Ask the model for structured XML the runner can translate."
          expressionDialogTitle="Document XML instructions"
          expressionDialogDescription="Sent as the user message after workflow tags are resolved; a fixed system prompt defines the XML vocabulary at runtime."
        />
      </div>

      {/* Uploaded artefact name */}
      <div className="space-y-1.5">
        <Label>File name</Label>
        <FunctionInput
          tags={outputFileNamePromptTags}
          value={String(data.outputFileName ?? "generated-document.docx")}
          onChange={({ value }) => set("outputFileName", value)}
          fieldInstanceId={`${nodeId}-document-xml-output-filename`}
          rows={3}
          placeholder="generated-document.docx"
          expressionDialogTitle="File name expression"
          expressionDialogDescription="Same behaviour as template documents — append .docx when missing."
        />
      </div>
    </div>
  )
}

/**
 * Document step execution settings: template upload to the isolated templates bucket, file name expression,
 * docxtemplater template schema map, and optional merge from Input-tab declared fields (`Import from input schema`).
 */
function DocumentExecutionConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
  workflowId,
  nodeId,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
  workflowId?: string | null
  nodeId: string
}) {
  const subtype = normaliseDocumentSubtype({ value: data.subtype as string | undefined })

  /** Tag palette for the file name field — mirrors other execution expressions (prev, input schema rows, globals, now). */
  const outputFileNamePromptTags = React.useMemo(() => {
    const fields = readInputSchemaFromNodeData({ value: data.inputSchema })
    return mergePromptTagDefinitions({
      contextual: [
        ...workflowGlobalPromptTags,
        ...upstreamPromptTags,
        ...nodeInputFieldsToPromptTags({ fields }),
      ],
    })
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  const documentSchemaFields = readInputSchemaFromNodeData({ value: data.documentSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })
  const canSetFromInput = inputSchemaFields.length > 0

  /** Header action — mirrors Input-tab fields into docxtemplater placeholder rows (`{{input.*}}` by default). */
  const documentTemplateConfirmables = React.useMemo(
    () => [
      {
        id: "set_template_from_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownFromLine,
        disabled: !canSetFromInput,
        alertTitle: "Import template schema from Input tab?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            This merges Input tab rows into the template schema: labels, types, and required flags match your declared
            step inputs. Blank cells become{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders for
            docxtemplater. Rows that already have mapping or default text keep their contents when using append; extra
            template-only keys stay at the end.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : documentSchemaFields
          const next = mergeEntryOutputSchemaFromInputFields({
            existingOutputFields: base,
            inputFields: inputSchemaFields,
          })
          set("documentSchema", next)
        },
      },
    ],
    [canSetFromInput, documentSchemaFields, inputSchemaFields, set],
  )

  if (subtype === "docxml") {
    return (
      <DocumentXmlExecutionConfig
        data={data}
        set={set}
        nodeId={nodeId}
        upstreamPromptTags={upstreamPromptTags}
        workflowGlobalPromptTags={workflowGlobalPromptTags}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Template file — uploads to workflow-document-templates (not outputs / other artefacts) */}
      <DocumentTemplateUploadField
        workflowId={workflowId}
        nodeId={nodeId}
        templateFileId={String(data.templateFileId ?? "").trim()}
        templateFileName={String(data.templateFileName ?? "").trim()}
        onTemplateRegistered={({
          templateFileId: nextTemplateId,
          templateFileName: nextTemplateName,
        }) => {
          set("templateFileId", nextTemplateId)
          set("templateFileName", nextTemplateName)
        }}
        onTemplateRemoved={() => {
          set("templateFileId", "")
          set("templateFileName", "")
        }}
      />

      {/* Generated file name — expression field with tag picker (same as increment / AI bindings) */}
      <div className="space-y-1.5">
        <Label>File name</Label>
        <FunctionInput
          tags={outputFileNamePromptTags}
          value={String(data.outputFileName ?? "generated-document.docx")}
          onChange={({ value }) => set("outputFileName", value)}
          fieldInstanceId={`${nodeId}-document-output-filename`}
          rows={3}
          placeholder="generated-document.docx"
          expressionDialogTitle="File name expression"
          expressionDialogDescription={
            <>
              Build the output filename with literals and tags — type {"{{"} to pick or use the list.{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{prev.*}}"}</code>, workflow{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{global.*}}"}</code>, and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{now.*}}"}</code> resolve at
              runtime. When the result has no{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">.docx</code> suffix, one is
              appended.
            </>
          }
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Opens the expression editor via the trailing <span className="font-medium text-foreground">fx</span> button for a
          full tag palette; inline, type {"{{"} for autocomplete.
        </p>
      </div>

      {!canSetFromInput ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add at least one field on the Input tab before you can{" "}
          <span className="font-medium text-foreground">Import from input schema</span> here.
        </p>
      ) : null}

      <InputSchemaBuilder
        fields={documentSchemaFields}
        onChange={({ fields }) => set("documentSchema", fields)}
        usageContext="prompt"
        panelTitle="Template schema"
        upstreamPromptTags={upstreamPromptTags}
        confirmableImports={documentTemplateConfirmables}
        promptImport={WORKFLOW_DOCUMENT_TEMPLATE_PROMPT_IMPORT}
      />
    </div>
  )
}

/**
 * Output mappings for document steps. `{{exe.documentUrl}}` and related execution fields are available.
 */
function DocumentOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const documentSubtype = normaliseDocumentSubtype({ value: data.subtype as string | undefined })
  const executionImportSpecs =
    documentSubtype === "docxml"
      ? DOCUMENT_XML_EXECUTION_IMPORT_SPECS
      : DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS

  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const documentExecutionPromptTags = React.useMemo(() => {
    const shared: PromptTagDefinition[] = [
      {
        id: "exe.documentUrl",
        label: "Generated document URL",
        description: "Signed URL for the generated document output.",
      },
      {
        id: "exe.outputPath",
        label: "Storage path",
        description: "Storage object path of the generated file.",
      },
      {
        id: "exe.outputFileName",
        label: "File name",
        description: "Filename used for the generated document.",
      },
      {
        id: "exe.outputBucket",
        label: "Output bucket",
        description: "Storage bucket holding the uploaded .docx.",
      },
    ]
    if (documentSubtype === "docxml") {
      return [
        ...shared,
        {
          id: "exe.contentXmlCharLength",
          label: "XML payload length",
          description: "Character length of the rendered XML fragment before conversion.",
        },
      ]
    }
    return [
      ...shared,
      {
        id: "exe.templateFileId",
        label: "Template id",
        description: "Registered template row used for this generation.",
      },
      {
        id: "exe.templateName",
        label: "Template name",
        description: "Human-readable template name from the registry.",
      },
    ]
  }, [documentSubtype])

  const canSyncFromInput = inputSchemaFields.length > 0

  /** Primary: execution outputs; secondary: mirror Input tab. */
  const documentOutputExecutionConfirmables = React.useMemo(
    () => [
      {
        id: "execution_outputs",
        label: "Import from execution",
        TriggerIcon: ArrowDownFromLine,
        alertTitle: "Import outputs from document execution?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            This adds or refreshes outbound rows keyed to runtime execution: file name, download URL, storage path,
            bucket,
            {documentSubtype === "docxml" ? (
              <> and XML payload diagnostics.</>
            ) : (
              <> and template metadata.</>
            )}{" "}
            Existing mapping cells with text are left as-is when using append.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeOutputSchemaFromExecutionSpecs({
              existingOutputFields: base,
              specs: executionImportSpecs,
            }),
          )
        },
      },
      {
        id: "import_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canSyncFromInput,
        alertTitle: "Import output fields from the input schema?",
        alertDescription: (
          <span className="text-pretty leading-relaxed">
            Mirrors Input tab rows into the output list with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code> placeholders.
          </span>
        ),
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          set(
            "outputSchema",
            mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: base,
              inputFields: inputSchemaFields,
            }),
          )
        },
      },
    ],
    [canSyncFromInput, documentSubtype, executionImportSpecs, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Execution → downstream keys: default new steps ship file name + URL; import fills the full `exe` surface */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        New steps default to <span className="font-medium text-foreground">file name</span> and{" "}
        <span className="font-medium text-foreground">document URL</span> from execution. Use{" "}
        <span className="font-medium text-foreground">Import from execution</span> first, then{" "}
        <span className="font-medium text-foreground">Import from input schema</span> or{" "}
        <span className="font-medium text-foreground">Import from prompt</span> from the menu as needed.
      </p>

      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={documentExecutionPromptTags}
        confirmableImports={documentOutputExecutionConfirmables}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />

      {/* Globals — same `exe.*` palette plus workflow-wide `global.*` */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={[...documentExecutionPromptTags, ...workflowGlobalPromptTags]}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/** Normalises `data.branches` into a mutable list with at least one case. */
function readSwitchBranches({ data }: { data: Record<string, unknown> }): SwitchBranch[] {
  const raw = data.branches
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped = (raw as Record<string, unknown>[]).map((src) => {
      const id = String(src?.id ?? "").trim()
      const gateGroup = src?.gateGroup
      const branch: SwitchBranch = {
        id,
        label: src?.label !== undefined ? String(src.label) : "",
        condition: src?.condition !== undefined ? String(src.condition) : "",
      }
      if (gateGroup !== undefined) {
        branch.gateGroup = gateGroup
      }
      return branch
    }).filter((b) => b.id.length > 0)
    if (mapped.length > 0) return mapped
  }
  return [{ id: "initial-case", label: "", condition: "" }]
}

/**
 * Switch node: expressions read from inbound payload (`input`).
 */
function SwitchInputConfig({
  data,
  set,
  upstreamPromptTags,
  inboundPick,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })
  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0
  const canImport = hasUpstream && selectedPredecessor != null

  function applyPreviousStepMappings(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  return (
    <div className="space-y-6">
      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>
          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}

      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_step",
                  label: "Import from previous step",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import mappings from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders that read the inbound step's output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import mappings",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousStepMappings(params),
                },
              ]
            : undefined
        }
        promptImport={hasUpstream ? WORKFLOW_STEP_INPUT_PROMPT_IMPORT : null}
      />
    </div>
  )
}

/**
 * Split node: shape inbound payload (`input`) for templating — fan-out itself has no conditions;
 * each path receives the same execution envelope from the runner.
 */
function SplitInputConfig({
  data,
  set,
  upstreamPromptTags,
  inboundPick,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })
  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0
  const canImport = hasUpstream && selectedPredecessor != null

  function applyPreviousStepMappings(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  return (
    <div className="space-y-6">
      {/* Upstream picker when multiple predecessors feed this split */}
      {hasUpstream ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upstream mapping</p>
          {predecessorNodes.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Use output from</Label>
              <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select upstream step" />
                </SelectTrigger>
                <SelectContent>
                  {predecessorNodes.map((n) => {
                    const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Declared inputs are available to expressions only; parallel branches still each receive the full inbound payload unchanged.
          </p>
        </div>
      ) : null}

      {/* inputSchema rows — same tooling as Switch / Decision */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_step",
                  label: "Import from previous step",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import mappings from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders that read the inbound step's output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import mappings",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousStepMappings(params),
                },
              ]
            : undefined
        }
        promptImport={hasUpstream ? WORKFLOW_STEP_INPUT_PROMPT_IMPORT : null}
      />
    </div>
  )
}

/** Seeds `split_fanout_count` for output mappings (`{{exe.split_fanout_count}}`). */
const SPLIT_FANOUT_COUNT_SEED_FIELD = createEmptyNodeInputField({
  partial: {
    key: "split_fanout_count",
    label: "Parallel path count",
    type: "number",
    required: false,
    description: "Number of outbound paths configured on this Split (parallel fan-out).",
    value: "{{exe.split_fanout_count}}",
  },
})

/**
 * Split node — step output and workflow globals (same pattern as Decision; branches live on the Branch tab).
 */
function SplitOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  // Auto-seed parallel path count on first open when the output schema is empty.
  React.useEffect(() => {
    if (outputSchemaFields.length === 0) {
      set("outputSchema", [SPLIT_FANOUT_COUNT_SEED_FIELD])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contextualPromptTags = React.useMemo(() => {
    return [
      {
        id: "exe.split_fanout_count",
        label: "Parallel path count",
        type: "number" as const,
        description: "Configured number of outbound split paths.",
      },
      ...nodeInputFieldsToPromptTags({ fields: inputSchemaFields }),
      ...upstreamPromptTags,
    ]
  }, [inputSchemaFields, upstreamPromptTags])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canImportFromInput = inputSchemaFields.length > 0

  const outputConfirmableImports = React.useMemo(
    () => [
      {
        id: "import_from_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canImportFromInput,
        alertTitle: "Import fields from the input schema?",
        alertDescription:
          "Copies all input fields into the output schema with {{input.*}} mappings. Rows that already have a mapping value stay as they are when using append. The parallel path count field is preserved.",
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          const merged = mergeEntryOutputSchemaFromInputFields({
            existingOutputFields: base,
            inputFields: inputSchemaFields,
          })
          const hasFanout = merged.some((f) => f.key === "split_fanout_count")
          set("outputSchema", hasFanout ? merged : [SPLIT_FANOUT_COUNT_SEED_FIELD, ...merged])
        },
      },
    ],
    [canImportFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Step output — keyed for {{prev.*}} on downstream inbound mapping */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={outputConfirmableImports}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />

      {/* Optional workflow globals */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/** Seeds `switch_matched_case_id` for output mappings (`{{exe.switch_matched_case_id}}`). */
const SWITCH_MATCHED_CASE_SEED_FIELD = createEmptyNodeInputField({
  partial: {
    key: "switch_matched_case_id",
    label: "Matched case id",
    type: "text",
    required: false,
    description: "Stable id of the first case whose condition was true, empty when the Else branch is used.",
    value: "{{exe.switch_matched_case_id}}",
  },
})

/** Seeds `switch_used_default` for output mappings (`{{exe.switch_used_default}}`). */
const SWITCH_USED_DEFAULT_SEED_FIELD = createEmptyNodeInputField({
  partial: {
    key: "switch_used_default",
    label: "Used default (Else) branch",
    type: "boolean",
    required: false,
    description: "True when no case condition matched and flow follows the Else exit.",
    value: "{{exe.switch_used_default}}",
  },
})

/**
 * Switch node — canvas branch labels plus step output / globals mapping (aligned with Decision).
 */
function SwitchOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  // Auto-seed switch routing fields on first open when the output schema is empty.
  React.useEffect(() => {
    if (outputSchemaFields.length === 0) {
      set("outputSchema", [SWITCH_MATCHED_CASE_SEED_FIELD, SWITCH_USED_DEFAULT_SEED_FIELD])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contextualPromptTags = React.useMemo(() => {
    return [
      {
        id: "exe.switch_matched_case_id",
        label: "Matched case id",
        type: "text" as const,
        description: "Stable id of the matched case, empty when Else is used.",
      },
      {
        id: "exe.switch_used_default",
        label: "Used Else branch",
        type: "boolean" as const,
        description: "True when no case matched.",
      },
      ...nodeInputFieldsToPromptTags({ fields: inputSchemaFields }),
      ...upstreamPromptTags,
    ]
  }, [inputSchemaFields, upstreamPromptTags])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canImportFromInput = inputSchemaFields.length > 0

  const outputConfirmableImports = React.useMemo(
    () => [
      {
        id: "import_from_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canImportFromInput,
        alertTitle: "Import fields from the input schema?",
        alertDescription:
          "Copies all input fields into the output schema with {{input.*}} mappings. Rows that already have a mapping value stay as they are when using append. The matched case id and Else branch flags are preserved.",
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          const merged = mergeEntryOutputSchemaFromInputFields({
            existingOutputFields: base,
            inputFields: inputSchemaFields,
          })
          let next = merged
          if (!next.some((f) => f.key === "switch_matched_case_id")) {
            next = [SWITCH_MATCHED_CASE_SEED_FIELD, ...next]
          }
          if (!next.some((f) => f.key === "switch_used_default")) {
            const idx = next.findIndex((f) => f.key === "switch_matched_case_id")
            const insertAt = idx >= 0 ? idx + 1 : 0
            next = [...next.slice(0, insertAt), SWITCH_USED_DEFAULT_SEED_FIELD, ...next.slice(insertAt)]
          }
          set("outputSchema", next)
        },
      },
    ],
    [canImportFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
        Name cases, add branches, route conditions, and the Else label live on the{" "}
        <span className="font-medium text-foreground">Conditions</span> tab. Here you shape what flows out to{" "}
        <code className="text-[10px]">{"{{prev.*}}"}</code> and optional workflow globals.
      </p>

      {/* Step output — keyed for {{prev.*}} on downstream inbound mapping */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={outputConfirmableImports}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />

      {/* Optional workflow globals — merged into the shared {{global.*}} envelope */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}

/** Predicate read from inbound `input`. */
function DecisionInputConfig({
  data,
  set,
  upstreamPromptTags,
  inboundPick,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  inboundPick: ReturnType<typeof useInboundPredecessorSelection>
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick
  const hasUpstream = predecessorNodes.length > 0
  const canImport = hasUpstream && selectedPredecessor != null

  /** Maps declared inputs to placeholder expressions that read the selected upstream step output (after confirmation). */
  function applyPreviousStepMappings(params?: { applyMode: WorkflowSchemaImportApplyMode }) {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next =
      params?.applyMode === "replace"
        ? replaceInputSchemaWithPreviousStepImport({ inferred })
        : mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  return (
    <div className="space-y-6">
      {/* Upstream source selector when multiple predecessors feed this node */}
      {hasUpstream && predecessorNodes.length > 1 ? (
        <div className="space-y-1.5">
          <Label>Use output from</Label>
          <Select value={inboundPick.resolvedSourceId ?? ""} onValueChange={(v) => setPickedSourceId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select upstream step" />
            </SelectTrigger>
            <SelectContent>
              {predecessorNodes.map((n) => {
                const label = String((n.data as Record<string, unknown>)?.label ?? n.id)
                return (
                  <SelectItem key={n.id} value={n.id}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Input schema with import-from-previous-step as the default action when an inbound edge exists */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
        promptImport={hasUpstream ? WORKFLOW_STEP_INPUT_PROMPT_IMPORT : null}
        confirmableImports={
          hasUpstream
            ? [
                {
                  id: "previous_step",
                  label: "Import from previous step",
                  TriggerIcon: ArrowDownToLine,
                  disabled: !canImport,
                  alertTitle: "Import mappings from the upstream step?",
                  alertDescription:
                    "New rows and matching keys get {{prev.*}} placeholders that read the inbound step's output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first (when using append).",
                  confirmLabel: "Import mappings",
                  offerApplyModeChoice: true,
                  onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => applyPreviousStepMappings(params),
                },
              ]
            : undefined
        }
      />
    </div>
  )
}

/**
 * Decision node — boolean gate: reads/writes `data.gateGroup` (visual) and compiles to
 * `data.condition` (JS string consumed by the runner) on every change.
 */
function DecisionGateConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const group: GateGroup = React.useMemo(
    () => readGateGroupFromNodeData({ value: data.gateGroup }) ?? createEmptyGateGroup(),
    // nodeId resets the group when switching nodes; data.gateGroup tracks in-session edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeId, data.gateGroup],
  )

  /**
   * Merges input.*, prev.*, and global.* tags for the gate field picker.
   * Filters out trigger.* and now.* which are not usable as condition field paths.
   */
  const gateTags = React.useMemo(() => {
    const inputTags = nodeInputFieldsToPromptTags({
      fields: readInputSchemaFromNodeData({ value: data.inputSchema }),
    })
    return [...inputTags, ...upstreamPromptTags, ...workflowGlobalPromptTags].filter((t) =>
      ["input", "prev", "global"].some((ns) => t.id.startsWith(`${ns}.`)),
    )
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  function handleGroupChange({ group: next }: { group: GateGroup }) {
    const condition = compileGateGroupToExpression({ group: next })
    set("gateGroup", next)
    set("condition", condition)
  }

  return (
    <div className="space-y-4">
      {/* Routing explanation */}
      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
        <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
          <div className="size-1.5 rounded-full bg-emerald-500" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          When ALL conditions match → <span className="font-medium text-emerald-700">True</span> path.
          Otherwise → <span className="font-medium text-rose-700">False</span> path. Empty conditions always take False.
        </p>
      </div>

      {/* Visual builder */}
      <WorkflowGateRuleBuilder
        builderId={`${nodeId}-decision`}
        group={group}
        onChange={handleGroupChange}
        upstreamTags={gateTags}
      />

      {/* Branch labels — shown here so Output can focus purely on schema mapping */}
      <div className="space-y-2">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Branch labels</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-emerald-600 text-xs">True branch</Label>
            <Input
              value={String(data.trueLabel ?? "True")}
              onChange={(e) => set("trueLabel", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-rose-600 text-xs">False branch</Label>
            <Input
              value={String(data.falseLabel ?? "False")}
              onChange={(e) => set("falseLabel", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Slide stack inside switch Conditions — same mental model as the app sidebar tiered drill. */
const switchConditionsSlideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "22%" : "-22%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-16%" : "16%", opacity: 0 }),
}

type SwitchConditionsPanel =
  /** Lists every case name; pick one to configure gate rules */
  | { view: "list" }
  /** Exactly one WorkflowGateRuleBuilder scoped to branchId */
  | { view: "case-detail"; branchId: string }

/**
 * Switch node — stacked navigation: browse cases by name, then push into a secondary pane for that
 * case's routing conditions (first match wins top to bottom; Else stays on the list view).
 */
function SwitchGateConfig({
  data,
  set,
  nodeId,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  nodeId: string
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const branches = readSwitchBranches({ data })

  /** Which stack frame is visible: case index list or detail for one branch id */
  const [panel, setPanel] = React.useState<SwitchConditionsPanel>({ view: "list" })
  /** +1 drills into a case; -1 pops back — drives motion direction like AppSidebar */
  const [navDirection, setNavDirection] = React.useState(1)

  /**
   * Merges input.*, prev.*, and global.* tags for gate pickers — matches Decision parity.
   */
  const gateTags = React.useMemo(() => {
    const inputTags = nodeInputFieldsToPromptTags({
      fields: readInputSchemaFromNodeData({ value: data.inputSchema }),
    })
    return [...inputTags, ...upstreamPromptTags, ...workflowGlobalPromptTags].filter((t) =>
      ["input", "prev", "global"].some((ns) => t.id.startsWith(`${ns}.`)),
    )
  }, [data.inputSchema, upstreamPromptTags, workflowGlobalPromptTags])

  /**
   * Reads the persisted gateGroup for a branch, or creates an empty one.
   * Each builder is keyed by branch id so the memo does not cross-contaminate cases.
   */
  function getBranchGroup(b: SwitchBranch): GateGroup {
    const raw = (b as unknown as Record<string, unknown>).gateGroup
    return readGateGroupFromNodeData({ value: raw }) ?? createEmptyGateGroup()
  }

  /**
   * Replaces branches array — single write path keeps canvas handles and persisted graph in sync.
   */
  function commitBranches({ next }: { next: SwitchBranch[] }) {
    set("branches", next)
  }

  /**
   * Compiles gate UI into the JS expression used by evaluateWorkflowGateExpression / planSwitchGate.
   */
  function handleBranchGroupChange({
    branchId,
    group,
  }: {
    branchId: string
    group: GateGroup
  }) {
    const condition = compileGateGroupToExpression({ group })
    const next = branches.map((b) =>
      b.id === branchId ? { ...b, condition, gateGroup: group } : b,
    )
    set("branches", next)
  }

  /**
   * Appends a routed case row with a stable id so canvas edges stay aligned with handle ids.
   */
  function addCase() {
    const id = `sw-${crypto.randomUUID().slice(0, 8)}`
    commitBranches({
      next: [...branches, { id, label: `Case ${branches.length + 1}`, condition: "" }],
    })
  }

  /**
   * Opens the gate editor for one branch from the stacked list pane.
   */
  function drillIntoCase({ branchId }: { branchId: string }) {
    setNavDirection(1)
    setPanel({ view: "case-detail", branchId })
  }

  /**
   * Returns to case list navigation from a case detail pane.
   */
  function popToCaseList() {
    setNavDirection(-1)
    setPanel({ view: "list" })
  }

  /**
   * Renames visible label for one case row (shown on canvas and in this navigator).
   */
  function renameCase({
    branchId,
    label,
  }: {
    branchId: string
    label: string
  }) {
    const next = branches.map((b) => (b.id === branchId ? { ...b, label } : b))
    commitBranches({ next })
  }

  /**
   * Removes a case branch when safe (at least one case must remain); closes detail if deleting current.
   */
  function deleteCase({
    branchId,
  }: {
    branchId: string
  }) {
    if (branches.length <= 1) return
    commitBranches({
      next: branches.filter((b) => b.id !== branchId),
    })
    if (panel.view === "case-detail" && panel.branchId === branchId) {
      popToCaseList()
    }
  }

  React.useEffect(() => {
    if (panel.view !== "case-detail") return
    if (!branches.some((b) => b.id === panel.branchId)) {
      /* Branch disappeared while viewing detail — e.g. graph restore; safe to reopen list root */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanel({ view: "list" })
    }
  }, [branches, panel])

  const activeBranch: SwitchBranch | null =
    panel.view === "case-detail"
      ? (branches.find((b) => b.id === panel.branchId) ?? null)
      : null
  const activeBranchIndex =
    activeBranch !== null ? branches.findIndex((b) => b.id === activeBranch.id) : -1

  return (
    <div className="relative min-h-[120px] overflow-hidden">
      <AnimatePresence initial={false} mode="wait" custom={navDirection}>
        <motion.div
          key={panel.view === "list" ? "switch-cases-root" : `switch-case:${panel.branchId}`}
          custom={navDirection}
          variants={switchConditionsSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        >
          {panel.view === "list" ? (
            <div className="space-y-4">
              {/* How routing behaves */}
              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-blue-500/40 bg-blue-500/15">
                  <div className="size-1.5 rounded-full bg-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cases are evaluated top to bottom. The first matching case fires; if none match, use the Else
                  outlet. Pick a case below to set its conditions, or add a new case.
                </p>
              </div>

              {/* Case list — one row per case, drill to edit conditions */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Cases
                </p>
                <div className="flex flex-col gap-1.5">
                  {branches.map((b, idx) => {
                    const displayName = b.label?.trim() ? b.label : "Unnamed case"
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => drillIntoCase({ branchId: b.id })}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-left transition-colors",
                          "hover:border-border hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Case {idx + 1}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    )
                  })}
                </div>
              </div>

              <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addCase}>
                <Plus className="size-4" aria-hidden />
                Add case
              </Button>

              <Separator />

              {/* Else handle label — lives on list level so it is not confused with case conditions */}
              <div className="space-y-1.5">
                <Label>Else branch label</Label>
                <Input
                  value={String(data.defaultBranchLabel ?? "Else")}
                  onChange={(e) => set("defaultBranchLabel", e.target.value)}
                  placeholder="Else"
                />
                <p className="text-xs text-muted-foreground">
                  Connect the Default handle when no case condition matches.
                </p>
              </div>
            </div>
          ) : activeBranch !== null && activeBranchIndex >= 0 ? (
            <div className="space-y-4">
              {/* Back to case list */}
              <button
                type="button"
                onClick={popToCaseList}
                className="mb-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span>All cases</span>
              </button>

              {/* Case title + rename */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Case {activeBranchIndex + 1}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor={`sw-case-name-${activeBranch.id}`}>Case name</Label>
                  <Input
                    id={`sw-case-name-${activeBranch.id}`}
                    value={activeBranch.label ?? ""}
                    onChange={(e) =>
                      renameCase({ branchId: activeBranch.id, label: e.target.value })
                    }
                    placeholder={`Case ${activeBranchIndex + 1}`}
                  />
                </div>
              </div>

              {/* Visual gate builder for this case only */}
              <WorkflowGateRuleBuilder
                builderId={`${nodeId}-sw-${activeBranch.id}`}
                group={getBranchGroup(activeBranch)}
                onChange={({ group }) =>
                  handleBranchGroupChange({ branchId: activeBranch.id, group })
                }
                upstreamTags={gateTags}
              />

              {/* Optional remove — keep at least one case */}
              {branches.length > 1 ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => deleteCase({ branchId: activeBranch.id })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remove this case
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Labels for downstream True / False handles. */
/** The fixed `decision_result` field seeded into the output schema on first open. */
const DECISION_RESULT_SEED_FIELD = createEmptyNodeInputField({
  partial: {
    key: "decision_result",
    label: "Decision result",
    type: "boolean",
    required: false,
    description: "The evaluated boolean result of the decision condition.",
    value: "{{exe.decision_result}}",
  },
})

/**
 * Decision node output — defines what this step exposes as `prev.*` to downstream steps,
 * and optional workflow globals written to the shared `global.*` envelope.
 *
 * Auto-seeds a `decision_result` boolean field on first open; also exposes
 * "Import from input schema" as the primary toolbar action (no Execution tab on this step).
 */
function DecisionOutputConfig({
  data,
  set,
  upstreamPromptTags,
  workflowGlobalPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  // Auto-seed decision_result on first open if the output schema is empty.
  React.useEffect(() => {
    if (outputSchemaFields.length === 0) {
      set("outputSchema", [DECISION_RESULT_SEED_FIELD])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contextualPromptTags = React.useMemo(() => {
    return [
      { id: "exe.decision_result", label: "Decision result", type: "boolean" as const, description: "Evaluated boolean result of the decision condition." },
      ...nodeInputFieldsToPromptTags({ fields: inputSchemaFields }),
      ...upstreamPromptTags,
    ]
  }, [inputSchemaFields, upstreamPromptTags])

  const globalsContextualTags = React.useMemo(
    () => [
      ...workflowGlobalPromptTags,
      ...nodeInputFieldsToPromptTags({ fields: outputSchemaFields }),
      ...contextualPromptTags,
    ],
    [workflowGlobalPromptTags, outputSchemaFields, contextualPromptTags],
  )

  const canImportFromInput = inputSchemaFields.length > 0

  const outputConfirmableImports = React.useMemo(
    () => [
      {
        id: "import_from_input",
        label: "Import from input schema",
        TriggerIcon: ArrowDownToLine,
        disabled: !canImportFromInput,
        alertTitle: "Import fields from the input schema?",
        alertDescription:
          "Copies all input fields into the output schema with {{input.*}} mappings. Rows that already have a mapping value stay as they are when using append. The decision_result field is preserved.",
        confirmLabel: "Import fields",
        offerApplyModeChoice: true,
        onConfirm: (params?: { applyMode: WorkflowSchemaImportApplyMode }) => {
          const base = params?.applyMode === "replace" ? [] : outputSchemaFields
          const merged = mergeEntryOutputSchemaFromInputFields({
            existingOutputFields: base,
            inputFields: inputSchemaFields,
          })
          const hasResultField = merged.some((f) => f.key === "decision_result")
          set("outputSchema", hasResultField ? merged : [DECISION_RESULT_SEED_FIELD, ...merged])
        },
      },
    ],
    [canImportFromInput, inputSchemaFields, outputSchemaFields, set],
  )

  return (
    <div className="space-y-6">
      {/* Step output — keyed for {{prev.*}} on downstream inbound mapping */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
        confirmableImports={outputConfirmableImports}
        promptImport={WORKFLOW_OUTPUT_SCHEMA_PROMPT_IMPORT}
      />

      {/* Optional workflow globals — merged into the shared {{global.*}} envelope */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
        promptImport={WORKFLOW_GLOBALS_SCHEMA_PROMPT_IMPORT}
      />
    </div>
  )
}
