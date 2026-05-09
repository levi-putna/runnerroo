"use client"

import * as React from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  BackgroundVariant,
  Panel,
  type ReactFlowInstance,
  ConnectionLineType,
  ConnectionMode,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { WorkflowSmoothEdge } from "./workflow-edge"
import { NodeSheet } from "./node-sheet"
import { NodeAddSheet, type NodeDefinition } from "./node-add-sheet"
import { WorkflowNodeContextMenu } from "./workflow-node-context-menu"
import { Button } from "@/components/ui/button"
import {
  buildDefaultGenerateTextOutputSchemaFields,
  buildDefaultClassifyOutputSchemaFields,
  buildDefaultRandomNumberOutputSchemaFields,
  buildDefaultIterationOutputSchemaFields,
  buildDefaultGenerateDocumentOutputSchemaFields,
} from "@/lib/workflows/engine/input-schema"
import { buildDefaultExtractFieldRows } from "@/lib/workflows/steps/ai/extract/defaults"
import { Plus } from "lucide-react"
import { getWorkflowMinimapNodeColour } from "@/lib/workflows/engine/node-type-registry"
import { layoutWorkflowGraphVertical } from "@/lib/workflows/engine/elk-workflow-layout"
import { downloadWorkflowFlowAsPng } from "@/lib/workflows/engine/download-workflow-flow-image"
import { defaultWorkflowCanvasNodes, workflowGraphBaseline } from "@/lib/workflows/engine/persist"
import type { NodeResult } from "@/lib/workflows/engine/types"
import { computeRunTraversedReactFlowEdgeIds } from "@/lib/workflows/engine/run-path"
import { WorkflowRunContext } from "@/lib/workflows/engine/run-context"
import { workflowNodeTypes } from "@/lib/workflows/workflow-node-types"
import { type SwitchBranch } from "@/lib/workflows/steps/logic/switch/node"
import { type SplitPath } from "@/lib/workflows/steps/logic/split/node"

/** Stable empty map for providers when no run overlay is active. */
const EMPTY_RUN_MAP = new Map<string, NodeResult>()

const edgeTypes = {
  workflow: WorkflowSmoothEdge,
}

/** Default edge style: closed arrow at the target end, coloured like the default edge stroke. */
const defaultEdgeOptions = {
  type: "workflow" as const,
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: "color-mix(in oklch, var(--muted-foreground) 48%, var(--background))",
  },
}

/** Matches {@link components/workflow/workflow-edge} run-path stroke so arrowheads align on traversed edges. */
const WORKFLOW_RUN_PATH_EDGE_STROKE =
  "color-mix(in oklch, oklch(0.52 0.16 148) 88%, var(--background))"

const initialNodes: Node[] = defaultWorkflowCanvasNodes()

const initialEdges: Edge[] = []

/**
 * Deep-clones node `data` for duplication (falls back to JSON when structuredClone cannot copy the value).
 */
function cloneWorkflowNodeData(data: Node["data"]): Record<string, unknown> {
  if (data == null || typeof data !== "object") return {}
  try {
    return structuredClone(data) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
    } catch {
      return { ...(data as Record<string, unknown>) }
    }
  }
}

export type WorkflowCanvasHandle = {
  /** Returns the current React Flow graph for persistence. */
  getGraph: () => { nodes: Node[]; edges: Edge[] }
  /** Replaces the canvas graph (e.g. after loading from the server). */
  setGraph: (p: { nodes: Node[]; edges: Edge[] }) => void
  /**
   * Runs ELK layered layout (top-to-bottom), updates node positions, then fits the viewport.
   */
  applyVerticalElkLayout: () => Promise<void>
  /**
   * Renders the flow to a PNG and triggers download (html-to-image; see React Flow download-image example).
   */
  downloadAsImage: (p: { fileName: string }) => Promise<void>
}

interface WorkflowCanvasProps {
  workflowId?: string
  /** When provided, seeds the canvas (use a parent `key` when the workflow identity changes). */
  initialNodes?: Node[]
  initialEdges?: Edge[]
  /** Called after mount when the user changes nodes or edges (not on initial mount). */
  onGraphChange?: (p: { graphBaseline: string }) => void
  /** Latest persisted node execution visuals for simulated runs */
  runState?: Map<string, NodeResult>
  /** Latest persisted run id from the current editor execution stream (optional). */
  liveRunId?: string | null
  /** Workflow Settings constants for `{{const.*}}` tags in the node sheet */
  workflowConstants?: Record<string, string>
}

/**
 * Node-based workflow editor (React Flow). Edges use theme `oklch` tokens via `var` / `color-mix`, not `hsl(var(--…))`, so strokes and connection previews render correctly.
 */
export const WorkflowCanvas = React.forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(
  function WorkflowCanvas(
    {
      workflowId,
      initialNodes: initialNodesProp,
      initialEdges: initialEdgesProp,
      onGraphChange,
      runState,
      liveRunId,
      workflowConstants = {},
    },
    ref
  ) {
    const seedNodes = initialNodesProp ?? initialNodes
    const seedEdges = initialEdgesProp ?? initialEdges

    const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges)
    const [selectedNode, setSelectedNode] = React.useState<Node | null>(null)
    const [detailSheetOpen, setDetailSheetOpen] = React.useState(false)
    const [addSheetOpen, setAddSheetOpen] = React.useState(false)
    const [nodeContextMenu, setNodeContextMenu] = React.useState<{
      x: number
      y: number
      node: Node
    } | null>(null)
    const rfInstance = React.useRef<ReactFlowInstance | null>(null)
    const flowWrapperRef = React.useRef<HTMLDivElement | null>(null)
    const graphHydratedRef = React.useRef(false)

    const effectiveRunMap = runState ?? EMPTY_RUN_MAP

    const edgesForDisplay = React.useMemo(() => {
      const traversedIds = computeRunTraversedReactFlowEdgeIds({
        edges,
        runState: effectiveRunMap,
      })
      if (traversedIds.size === 0) return edges
      return edges.map((e) => {
        const onRunPath = traversedIds.has(e.id)
        if (!onRunPath) return e
        const baseData = (e.data ?? {}) as Record<string, unknown>
        const baseMarker = e.markerEnd ?? defaultEdgeOptions.markerEnd
        const markerEnd =
          baseMarker && typeof baseMarker === "object"
            ? { ...baseMarker, color: WORKFLOW_RUN_PATH_EDGE_STROKE }
            : baseMarker
        return {
          ...e,
          data: { ...baseData, onRunPath: true },
          markerEnd,
        }
      })
    }, [edges, effectiveRunMap])

  React.useImperativeHandle(
    ref,
    () => ({
      getGraph: () => ({ nodes, edges }),
      setGraph: ({ nodes: nextNodes, edges: nextEdges }) => {
        setNodes(nextNodes)
        setEdges(nextEdges)
      },
      applyVerticalElkLayout: async () => {
        const rf = rfInstance.current
        if (!rf) return
        const { nodes: nextNodes } = await layoutWorkflowGraphVertical({
          nodes: rf.getNodes(),
          edges: rf.getEdges(),
        })
        setNodes(nextNodes)
        requestAnimationFrame(() => {
          rf.fitView({ padding: 0.4 })
        })
      },
      downloadAsImage: async ({ fileName }) => {
        const root = flowWrapperRef.current
        if (!root) return
        await downloadWorkflowFlowAsPng({ flowRoot: root, fileName })
      },
    }),
    [nodes, edges, setNodes, setEdges]
  )

  React.useEffect(() => {
    if (!onGraphChange) return
    if (!graphHydratedRef.current) {
      graphHydratedRef.current = true
      return
    }
    onGraphChange({
      graphBaseline: workflowGraphBaseline({ nodes, edges }),
    })
  }, [nodes, edges, onGraphChange])

  /** Only one outbound edge per source handle; many inbound edges allowed per target. */
  const isValidConnection = React.useCallback<IsValidConnection<Edge>>(
    (edgeOrConnection) => {
      const source = edgeOrConnection.source
      const sourceHandle = edgeOrConnection.sourceHandle ?? "__default"
      return !edges.some(
        (edge) => edge.source === source && (edge.sourceHandle ?? "__default") === sourceHandle
      )
    },
    [edges]
  )

  const onConnect = React.useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...defaultEdgeOptions,
          },
          eds
        )
      ),
    [setEdges]
  )

  /**
   * Opens the node detail sheet for editing (same as double-clicking the node on the canvas).
   */
  function openNodeDetailSheet(node: Node) {
    setNodeContextMenu(null)
    setSelectedNode(node)
    setDetailSheetOpen(true)
  }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    openNodeDetailSheet(node)
  }

  function handleNodeDoubleClick(_: React.MouseEvent, node: Node) {
    openNodeDetailSheet(node)
  }

  function handleNodeContextMenu(event: React.MouseEvent, node: Node) {
    event.preventDefault()
    setNodeContextMenu({ x: event.clientX, y: event.clientY, node })
  }

  function handlePaneClick() {
    setNodeContextMenu(null)
    setSelectedNode(null)
    setDetailSheetOpen(false)
  }

  /**
   * Inserts a copy of the node with a new id, offset position, and cloned configuration (edges are not copied).
   */
  function duplicateWorkflowNode(source: Node) {
    const newId = `${String(source.type)}-${Date.now()}`
    const data = cloneWorkflowNodeData(source.data)
    const position = { x: source.position.x + 48, y: source.position.y + 48 }
    const copy: Node = {
      id: newId,
      type: source.type,
      position,
      data,
    }
    if (source.width != null) copy.width = source.width
    if (source.height != null) copy.height = source.height
    setNodes((nds) => [...nds, copy])
  }

  function handleAddNode(def: NodeDefinition) {
    const id = `${def.type}-${Date.now()}`

    // Place new node below the lowest existing node, centred
    let x = 300
    let y = 200
    if (nodes.length > 0) {
      const maxY = Math.max(...nodes.map((n) => n.position.y))
      const lowestNode = nodes.find((n) => n.position.y === maxY)
      x = lowestNode ? lowestNode.position.x : x
      y = maxY + 160
    }

    let nodeData: Record<string, unknown> = { ...def.defaultData }
    if (
      def.type === "ai" &&
      (def.subtype === "generate" || def.subtype === "transform" || def.subtype === "summarize")
    ) {
      nodeData = {
        ...nodeData,
        outputSchema: buildDefaultGenerateTextOutputSchemaFields(),
      }
    }

    if (def.type === "ai" && def.subtype === "classify") {
      nodeData = {
        ...nodeData,
        outputSchema: buildDefaultClassifyOutputSchemaFields(),
      }
    }

    if (def.type === "ai" && def.subtype === "extract") {
      nodeData = {
        ...nodeData,
        extractFields: buildDefaultExtractFieldRows(),
      }
    }

    if (def.type === "random") {
      nodeData = {
        ...nodeData,
        outputSchema: buildDefaultRandomNumberOutputSchemaFields(),
        randomMinExpression: typeof nodeData.randomMinExpression === "string" ? nodeData.randomMinExpression : "0",
        randomMaxExpression: typeof nodeData.randomMaxExpression === "string" ? nodeData.randomMaxExpression : "100",
      }
    }

    if (def.type === "iteration") {
      nodeData = {
        ...nodeData,
        outputSchema: buildDefaultIterationOutputSchemaFields(),
        iterationStartingNumberExpression:
          typeof nodeData.iterationStartingNumberExpression === "string"
            ? nodeData.iterationStartingNumberExpression
            : "{{input.starting_number}}",
        iterationIncrement: typeof nodeData.iterationIncrement === "string" ? nodeData.iterationIncrement : "1",
      }
    }

    if (def.type === "document") {
      nodeData = {
        ...nodeData,
        outputSchema: buildDefaultGenerateDocumentOutputSchemaFields(),
      }
    }

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: def.type,
        position: { x, y },
        data: nodeData,
      },
    ])

    // Auto-scroll to new node
    setTimeout(() => {
      rfInstance.current?.fitView({ padding: 0.25, duration: 400 })
    }, 50)
  }

  /**
   * Merges data onto a node and drops outbound edges whose `sourceHandle` no longer exists
   * (e.g. removed switch cases).
   */
  function handleUpdateNode(nodeId: string, data: Record<string, unknown>) {
    let validOutbound: Set<string> | null = null

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n
        const merged = { ...n.data, ...data }
        const t = n.type
        if (t === "decision") validOutbound = new Set(["true", "false"])
        if (t === "end") validOutbound = new Set()
        if (t === "switch") {
          const branches: SwitchBranch[] =
            Array.isArray(merged.branches) && (merged.branches as SwitchBranch[]).length > 0
              ? (merged.branches as SwitchBranch[])
              : [{ id: "initial-case" }]
          validOutbound = new Set([
            ...branches.map((b) => `case-${b.id}`),
            "default",
          ])
        }
        if (t === "split") {
          const paths: SplitPath[] =
            Array.isArray(merged.paths) && (merged.paths as SplitPath[]).length > 0
              ? (merged.paths as SplitPath[])
              : [{ id: "sp-a" }, { id: "sp-b" }]
          validOutbound = new Set(paths.map((p) => `path-${p.id}`))
        }
        return { ...n, data: merged }
      })
    )

    if (validOutbound)
      setEdges((eds) =>
        eds.filter((e) => {
          if (e.source !== nodeId) return true
          const handle = e.sourceHandle ?? "__default"
          return validOutbound!.has(handle)
        })
      )
  }

  function handleDeleteNode(nodeId: string) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
    setDetailSheetOpen(false)
  }

  return (
    <WorkflowRunContext.Provider value={effectiveRunMap}>
    <div ref={flowWrapperRef} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edgesForDisplay}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onInit={(instance) => {
          rfInstance.current = instance
        }}
        nodeTypes={workflowNodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionMode={ConnectionMode.Strict}
        connectionLineStyle={{
          strokeWidth: 1.35,
          stroke: "color-mix(in oklch, var(--muted-foreground) 55%, var(--background))",
        }}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode="Backspace"
        className="dailify-workflow-flow"
      >
        {/* Controls — bottom left */}
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="[&>button]:border-border [&>button]:bg-background [&>button]:text-foreground [&>button:hover]:bg-accent shadow border border-border rounded-lg overflow-hidden m-4"
        />

        {/* Minimap — bottom right */}
        <MiniMap
          position="bottom-right"
          className="!bg-card !border !border-border !rounded-lg !shadow-sm !m-4"
          nodeColor={(node) =>
            getWorkflowMinimapNodeColour({
              type: node.type,
              data: node.data as Record<string, unknown>,
            })
          }
          maskColor="color-mix(in oklch, var(--muted) 60%, transparent)"
        />

        {/* Add step button — top right */}
        <Panel position="top-right" className="m-4">
          <Button
            onClick={() => setAddSheetOpen(true)}
            className="gap-2 shadow-sm"
          >
            <Plus className="size-4" />
            Add step
          </Button>
        </Panel>

        <Background variant={BackgroundVariant.Dots} gap={22} size={1} className="opacity-0" />
      </ReactFlow>

      {/* Node detail sheet */}
      <NodeSheet
        node={selectedNode}
        workflowId={workflowId}
        open={detailSheetOpen}
        onClose={() => setDetailSheetOpen(false)}
        onUpdate={handleUpdateNode}
        onDelete={handleDeleteNode}
        graphNodes={nodes}
        graphEdges={edges}
        liveRunId={liveRunId}
        workflowConstants={workflowConstants}
      />

      {/* Add step sheet */}
      <NodeAddSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={handleAddNode}
      />

      <WorkflowNodeContextMenu
        open={nodeContextMenu != null}
        x={nodeContextMenu?.x ?? 0}
        y={nodeContextMenu?.y ?? 0}
        onClose={() => {
          setNodeContextMenu(null)
        }}
        onEdit={() => {
          if (nodeContextMenu?.node) openNodeDetailSheet(nodeContextMenu.node)
        }}
        onDuplicate={() => {
          if (nodeContextMenu?.node) duplicateWorkflowNode(nodeContextMenu.node)
        }}
        onDelete={() => {
          if (nodeContextMenu?.node) handleDeleteNode(nodeContextMenu.node.id)
        }}
      />
    </div>
    </WorkflowRunContext.Provider>
  )
  }
)

WorkflowCanvas.displayName = "WorkflowCanvas"
