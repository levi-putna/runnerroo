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
import { ArrowDownFromLine, ArrowDownToLine, Plus, Trash2 } from "lucide-react"
import {
  getWorkflowSheetTypeLabel,
  normaliseAiSubtype,
  normaliseEntryKind,
  type WorkflowEntryKind,
} from "@/lib/workflow/node-type-registry"
import { WorkflowNodeIconTile } from "@/components/workflow/node-type-presentation"
import type { SwitchBranch } from "./node-types/switch-node"
import type { SplitPath } from "./node-types/split-node"
import { ModelSelector } from "@/components/model-selector"
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models"
import { InputSchemaBuilder } from "@/components/workflow/input-schema-builder"
import { SystemPromptField } from "@/components/workflow/system-prompt-field"
import { readInputSchemaFromNodeData } from "@/lib/workflow/input-schema"
import {
  mergePromptTagDefinitions,
  generateTextExecutionPromptTags,
  numericExeNumberPromptTags,
  nodeInputFieldsToPromptTags,
  prevPromptTagsFromPredecessorNode,
  workflowGlobalsPromptTagsFromNodes,
  type PromptTagDefinition,
} from "@/lib/workflow/prompt-tags"
import {
  inferPreviousStepOutputFields,
  listInboundSourcesForNode,
  mergeInputSchemaWithPreviousStepImport,
} from "@/lib/workflow/previous-step-import"
import { mergeEntryOutputSchemaFromInputFields } from "@/lib/workflow/schema-mapping-merge"
import { WorkflowSchemaImportButtonWithDialog } from "@/components/workflow/workflow-schema-import-button-with-dialog"
import { FunctionInput } from "@/components/workflow/function-input"
import { WorkflowRunContext } from "@/lib/workflow/run-context"
import { RunStepDetailSheetBody } from "@/components/workflow/run-step-detail-sheet-body"
import { resolveRunStepTimelineLabel } from "@/lib/workflow/run-timeline"

interface NodeSheetProps {
  node: Node | null
  open: boolean
  onClose: () => void
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onDelete: (nodeId: string) => void
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
 * Computes whether the sheet should show Input, Execution, and Output tabs for the given node.
 * Tabs are omitted entirely when no secondary sections apply.
 */
function getNodeSheetTabVisibility({
  nodeType,
  entryKind,
  aiSubtype,
}: {
  nodeType?: string | null
  entryKind?: WorkflowEntryKind | null
  aiSubtype?: string | null
}) {
  const entryShowsInputTab = nodeType === "entry"

  const showInput =
    entryShowsInputTab ||
    nodeType === "ai" ||
    nodeType === "code" ||
    nodeType === "random" ||
    nodeType === "iteration" ||
    nodeType === "decision" ||
    nodeType === "switch"

  // Step behaviour distinct from inbound payload shaping (instructions, runnable code, numeric increment, etc.).
  const showExecution = nodeType === "ai" || nodeType === "code" || nodeType === "iteration"

  const manualEntryShowsOutput = nodeType === "entry" && entryKind === "manual"

  const showAiGenerateOutput =
    nodeType === "ai" && normaliseAiSubtype({ value: aiSubtype }) === "generate"

  const showNumericComputationOutput = nodeType === "random" || nodeType === "iteration"

  const showOutput =
    nodeType === "decision" ||
    nodeType === "switch" ||
    nodeType === "split" ||
    manualEntryShowsOutput ||
    showAiGenerateOutput ||
    showNumericComputationOutput

  return { showInput, showExecution, showOutput }
}

/**
 * Right-hand sheet for workflow nodes: General / Input / Execution / Output when applicable,
 * plus **Run** (captured input, output, errors) when this step has data from the latest editor execution.
 */
export function NodeSheet({
  node,
  open,
  onClose,
  onUpdate,
  onDelete,
  graphNodes = [],
  graphEdges = [],
  liveRunId,
}: NodeSheetProps) {
  const [localData, setLocalData] = React.useState<Record<string, unknown>>({})
  const runMap = React.useContext(WorkflowRunContext)
  /** Active primary tab in the node sheet (includes Run when execution data exists for this node). */
  const [activeSheetTab, setActiveSheetTab] = React.useState<
    "general" | "input" | "execution" | "output" | "run"
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
  const entryKindForTabs =
    sheetNode.type === "entry"
      ? normaliseEntryKind({ value: localData.entryType as string | undefined })
      : null
  const { showInput, showExecution, showOutput } = getNodeSheetTabVisibility({
    nodeType: sheetNode.type,
    entryKind: entryKindForTabs,
    aiSubtype: sheetNode.type === "ai" ? (localData.subtype as string | undefined) : undefined,
  })
  const useTabs = showInput || showExecution || showOutput
  const stepRunResult = runMap.get(sheetNode.id)
  const showRunTab = stepRunResult !== undefined
  const useTabStrip = useTabs || showRunTab
  const tabCount =
    1 +
    (showInput ? 1 : 0) +
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
                    tabCount === 2 && "grid-cols-2",
                    tabCount === 3 && "grid-cols-3",
                    tabCount === 4 && "grid-cols-4",
                    tabCount === 5 && "grid-cols-5",
                    tabCount >= 6 && "grid-cols-6",
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
                    sheetNode.type === "iteration" ? (
                      <CodeInputConfig data={localData} set={set} upstreamPromptTags={upstreamPromptTags} />
                    ) : null}
                    {sheetNode.type === "decision" ? (
                      <DecisionInputConfig data={localData} set={set} upstreamPromptTags={upstreamPromptTags} />
                    ) : null}
                    {sheetNode.type === "switch" ? (
                      <SwitchInputConfig data={localData} set={set} upstreamPromptTags={upstreamPromptTags} />
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
                  </TabsContent>
                ) : null}

                {/* Output: branching */}
                {showOutput ? (
                  <TabsContent value="output" className="mt-4 space-y-4 outline-none">
                    {sheetNode.type === "entry" ? (
                      <EntryManualOutputConfig
                        data={localData}
                        set={set}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "ai" &&
                    normaliseAiSubtype({ value: localData.subtype as string | undefined }) === "generate" ? (
                      <AiGenerateOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
                      />
                    ) : null}
                    {sheetNode.type === "decision" ? <DecisionOutputConfig data={localData} set={set} /> : null}
                    {sheetNode.type === "switch" ? <SwitchOutputConfig data={localData} set={set} /> : null}
                    {sheetNode.type === "split" ? <SplitOutputConfig data={localData} set={set} /> : null}
                    {sheetNode.type === "random" || sheetNode.type === "iteration" ? (
                      <NumericComputationOutputConfig
                        data={localData}
                        set={set}
                        upstreamPromptTags={upstreamPromptTags}
                        workflowGlobalPromptTags={workflowGlobalPromptTags}
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

  return (
    <div className="space-y-6">
      {/* Maps declared outbound keys to expressions — defaults reference AI SDK execution fields */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
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
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
  workflowGlobalPromptTags: PromptTagDefinition[]
}) {
  const outputSchemaFields = readInputSchemaFromNodeData({ value: data.outputSchema })
  const globalsSchemaFields = readInputSchemaFromNodeData({ value: data.globalsSchema })

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

  return (
    <div className="space-y-6">
      {/* Step outputs keyed for {{prev.*}} on downstream inbound mapping */}
      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={contextualPromptTags}
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={globalsContextualTags}
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
 * Manual entry only: declares what leaves the trigger so inbound form fields line up with downstream placeholders.
 */
function EntryManualOutputConfig({
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

  /** Match the manual output row tag palette: Input tab, output keys, declared `global.*`, and `now.*` (via merge inside the editor). */
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
      {/* CTA banner — pairing with AiInput upstream import for predictable mapping affordances */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payload parity</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Keep outbound keys aligned with what you collect on the Input tab so later steps consume the same names.
          Clearing a mapped value beforehand lets another sync hydrate it again.
        </p>
        <WorkflowSchemaImportButtonWithDialog
          disabled={!canSyncFromPayload}
          triggerLabel="Sync from input schema"
          TriggerIcon={ArrowDownFromLine}
          alertTitle="Sync output from input schema?"
          alertDescription={
            <span className="text-pretty leading-relaxed">
              This merges input rows into output: labels, types, and required flags follow your payload declaration.
              Blank mapping values become{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">{"{{input.*}}"}</code>{" "}
              placeholders. Rows that already have mapping or default text keep their contents; extra output-only rows
              stay at the end.
            </span>
          }
          confirmLabel="Sync now"
          onConfirm={() => {
            const next = mergeEntryOutputSchemaFromInputFields({
              existingOutputFields: outputSchemaFields,
              inputFields: inputSchemaFields,
            })
            set("outputSchema", next)
          }}
        />
        {!canSyncFromPayload ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add at least one field on the Input tab before syncing.
          </p>
        ) : null}
      </div>

      <InputSchemaBuilder
        fields={outputSchemaFields}
        onChange={({ fields }) => set("outputSchema", fields)}
        usageContext="output"
      />
      {/* Optional workflow globals — merged on the runner envelope for downstream {{global.*}} */}
      <InputSchemaBuilder
        fields={globalsSchemaFields}
        onChange={({ fields }) => set("globalsSchema", fields)}
        usageContext="globals"
        contextualPromptTags={globalsContextualTags}
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

      {/* Payload schema — manual runs, webhooks, and schedules */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="trigger"
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
  const subtype = normaliseAiSubtype({ value: data.subtype as string | undefined })
  const isGenerateText = subtype === "generate"

  const { predecessorNodes, setPickedSourceId, selectedPredecessor } = inboundPick

  /** Maps declared inputs to placeholder expressions that read the selected upstream step output (after confirmation). */
  function applyPreviousStepMappings() {
    if (!selectedPredecessor) return
    const inferred = inferPreviousStepOutputFields({ previousNode: selectedPredecessor })
    const existing = readInputSchemaFromNodeData({ value: data.inputSchema })
    const next = mergeInputSchemaWithPreviousStepImport({ existingFields: existing, inferred })
    set("inputSchema", next)
  }

  const canImport = predecessorNodes.length > 0 && selectedPredecessor != null

  return (
    <div className="space-y-6">
      {isGenerateText ? (
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

          <WorkflowSchemaImportButtonWithDialog
            disabled={!canImport}
            triggerLabel="Import from previous step"
            TriggerIcon={ArrowDownToLine}
            alertTitle="Import mappings from the upstream step?"
            alertDescription="New rows and matching keys get {{prev.*}} placeholders that read the inbound step’s output. Rows that already have a non-empty mapping value stay as they are unless you clear the cell first."
            confirmLabel="Import mappings"
            onConfirm={() => applyPreviousStepMappings()}
          />
          {predecessorNodes.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect an upstream step to this one to copy mapped inputs from its output.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Confirm before merging: empty mapping cells ingest upstream references; populated cells remain unless you clear them first.
            </p>
          )}
        </div>
      ) : null}

      {/* Declared inputs: typed shape + mapping; referenced in the prompt as {{input.key}} */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="prompt"
        upstreamPromptTags={upstreamPromptTags}
        contextualPromptTags={workflowGlobalPromptTags}
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

  return (
    <div className="w-full space-y-6">
      {/* Model row — full width */}
      <div className="w-full space-y-1.5">
        <Label>Model</Label>
        <ModelSelector
          selectedModelId={String(data.model ?? DEFAULT_MODEL_ID)}
          onModelChange={({ modelId }) => set("model", modelId)}
          defaultModelType="text"
          triggerClassName="w-full max-w-none"
        />
      </div>

      {/* Instruction body */}
      <div className="w-full space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instructions</p>
        <SystemPromptField
          tags={promptTags}
          value={String(data.prompt ?? "")}
          onChange={({ value }) => set("prompt", value)}
          fieldInstanceId={nodeId}
          rows={14}
          helperText={
            "Type {{ to pick inbound {{prev.*}} from the wired predecessor, {{input.*}} from the Input tab, workflow {{global.*}} keys declared on any step, and {{now.*}}."
          }
          expressionDialogTitle="Instructions"
          expressionDialogDescription={
            "Insert {{prev.*}} from the inbound step, {{input.*}} from the Input tab, {{global.*}} from Workflow globals on any step, and built-in {{now.*}} timestamps."
          }
        />
      </div>
    </div>
  )
}

/** Expected step inputs for a code node; runnable source lives on the Execution tab. */
function CodeInputConfig({
  data,
  set,
  upstreamPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  return (
    <div className="space-y-6">
      {/* Expected step inputs; same schema model as AI steps for a consistent experience */}
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
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

/** Normalises `data.branches` into a mutable list with at least one case. */
function readSwitchBranches({ data }: { data: Record<string, unknown> }): SwitchBranch[] {
  const raw = data.branches
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped = (raw as Partial<SwitchBranch>[]).map((b) => ({
      id: String(b?.id ?? "").trim(),
      label: b?.label !== undefined ? String(b.label) : "",
      condition: b?.condition !== undefined ? String(b.condition) : "",
    })).filter((b) => b.id.length > 0)
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
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
}) {
  const branches = readSwitchBranches({ data })
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  function commitBranches({ next }: { next: SwitchBranch[] }) {
    set("branches", next)
  }

  /** Applies a partial update to one switch branch while preserving stable IDs. */
  function patchBranch({
    index,
    partial,
  }: {
    index: number
    partial: Partial<Pick<SwitchBranch, "label" | "condition">>
  }) {
    const next = branches.map((b, i) => (i === index ? { ...b, ...partial } : b))
    commitBranches({ next })
  }

  /** Removes a case unless it would leave the Switch empty (canvas requires ≥1 outbound path before default). */
  function removeBranch({ index }: { index: number }) {
    if (branches.length <= 1) return
    commitBranches({ next: branches.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-6">
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
      />

      <Separator />

      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conditions</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Cases run top to bottom. The first matching condition is taken. If none match, the Else connection is used.
        </p>

        {/* Per-case predicates */}
        <div className="space-y-3">
          {branches.map((b, idx) => (
            <div key={b.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Case {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 px-2"
                  disabled={branches.length <= 1}
                  onClick={() => removeBranch({ index: idx })}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  <span className="sr-only">Remove case</span>
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <Input
                  value={b.condition ?? ""}
                  onChange={(e) => patchBranch({ index: idx, partial: { condition: e.target.value } })}
                  placeholder='input.type === "email"'
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">JavaScript expression evaluated at runtime</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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
 * Split node: labels and count of parallel exits (each handle emits the same payload).
 */
function SplitOutputConfig({ data, set }: { data: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const paths = readSplitPaths({ data })

  function commitPaths({ next }: { next: SplitPath[] }) {
    set("paths", next)
  }

  /** Adds another parallel exit with a fresh stable id for edges. */
  function addPath() {
    const id = `sp-${crypto.randomUUID().slice(0, 8)}`
    commitPaths({
      next: [...paths, { id, label: `Path ${paths.length + 1}` }],
    })
  }

  /** Updates one path label while preserving ids. */
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

  /** Removes a path unless it would leave the Split with no exits. */
  function removePath({ index }: { index: number }) {
    if (paths.length <= 1) return
    commitPaths({ next: paths.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parallel paths</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Connect each path to a different downstream step. At runtime every path receives the same inbound payload; there is no condition or ordering.
      </p>

      <div className="space-y-3">
        {paths.map((p, idx) => (
          <div key={p.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Path {idx + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 px-2"
                disabled={paths.length <= 1}
                onClick={() => removePath({ index: idx })}
              >
                <Trash2 className="size-3.5" aria-hidden />
                <span className="sr-only">Remove path</span>
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Branch label</Label>
              <Input
                value={p.label ?? ""}
                onChange={(e) => patchPath({ index: idx, partial: { label: e.target.value } })}
                placeholder={`Path ${idx + 1}`}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addPath}>
        <Plus className="size-4" aria-hidden />
        Add path
      </Button>
    </div>
  )
}

/**
 * Switch node: outbound path labels plus default Else handle text.
 */
function SwitchOutputConfig({ data, set }: { data: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const branches = readSwitchBranches({ data })

  function commitBranches({ next }: { next: SwitchBranch[] }) {
    set("branches", next)
  }

  /** Adds a new case after the existing list with a fresh stable id for connections. */
  function addBranch() {
    const id = `sw-${crypto.randomUUID().slice(0, 8)}`
    commitBranches({
      next: [...branches, { id, label: `Case ${branches.length + 1}`, condition: "" }],
    })
  }

  /** Applies a partial update to one branch (Output tab edits labels). */
  function patchBranch({
    index,
    partial,
  }: {
    index: number
    partial: Partial<Pick<SwitchBranch, "label" | "condition">>
  }) {
    const next = branches.map((b, i) => (i === index ? { ...b, ...partial } : b))
    commitBranches({ next })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outgoing paths</p>

      {/* Case labels */}
      <div className="space-y-3">
        {branches.map((b, idx) => (
          <div key={b.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Case {idx + 1}
            </span>
            <div className="space-y-1.5">
              <Label>Branch label</Label>
              <Input
                value={b.label ?? ""}
                onChange={(e) => patchBranch({ index: idx, partial: { label: e.target.value } })}
                placeholder={`Case ${idx + 1}`}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addBranch}>
        <Plus className="size-4" aria-hidden />
        Add case
      </Button>

      <Separator />

      {/* Default (else) exit */}
      <div className="space-y-1.5">
        <Label>Else branch label</Label>
        <Input
          value={String(data.defaultBranchLabel ?? "Else")}
          onChange={(e) => set("defaultBranchLabel", e.target.value)}
          placeholder="Else"
        />
        <p className="text-xs text-muted-foreground">
          Connect the bottom handle marked Default when no case condition is true.
        </p>
      </div>
    </div>
  )
}

/** Predicate read from inbound `input`. */
function DecisionInputConfig({
  data,
  set,
  upstreamPromptTags,
}: {
  data: Record<string, unknown>
  set: (k: string, v: unknown) => void
  upstreamPromptTags: PromptTagDefinition[]
}) {
  const inputSchemaFields = readInputSchemaFromNodeData({ value: data.inputSchema })

  return (
    <div className="space-y-6">
      <InputSchemaBuilder
        fields={inputSchemaFields}
        onChange={({ fields }) => set("inputSchema", fields)}
        usageContext="code"
        upstreamPromptTags={upstreamPromptTags}
      />

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condition</p>
        <div className="space-y-1.5">
          <Label>Condition</Label>
          <Input
            value={String(data.condition ?? "")}
            onChange={(e) => set("condition", e.target.value)}
            placeholder='input.status === "success"'
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">JavaScript expression evaluated at runtime</p>
        </div>
      </div>
    </div>
  )
}

/** Labels for downstream True / False handles. */
function DecisionOutputConfig({ data, set }: { data: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Branch labels</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-emerald-600">True branch label</Label>
          <Input
            value={String(data.trueLabel ?? "True")}
            onChange={(e) => set("trueLabel", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-rose-600">False branch label</Label>
          <Input
            value={String(data.falseLabel ?? "False")}
            onChange={(e) => set("falseLabel", e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
