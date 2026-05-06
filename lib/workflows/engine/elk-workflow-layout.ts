import ELK from "elkjs/lib/elk.bundled.js"
import type { Edge, Node } from "@xyflow/react"
import { Position } from "@xyflow/react"

const elk = new ELK()

/** Width used when a node has not been measured yet (matches typical step card width). */
const DEFAULT_NODE_WIDTH = 260

/** Height used when a node has not been measured yet. */
const DEFAULT_NODE_HEIGHT = 96

const elkLayoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.spacing.nodeNode": "80",
} as const

/**
 * Returns pixel width/height for ELK from a React Flow node (prefers measured dimensions).
 */
function getNodeDimensionsForElk(node: Node): { width: number; height: number } {
  const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH
  const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT
  return { width: w, height: h }
}

/**
 * Applies an ELK layered top-to-bottom layout, following the React Flow + elkjs integration pattern
 * (see the React Flow elkjs example: https://reactflow.dev/examples/layout/elkjs).
 *
 * @returns Nodes with updated `position`, `sourcePosition`, and `targetPosition` for vertical flow.
 */
export async function layoutWorkflowGraphVertical({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): Promise<{ nodes: Node[] }> {
  if (nodes.length === 0) {
    return { nodes: [] }
  }

  const graph = {
    id: "root",
    layoutOptions: { ...elkLayoutOptions },
    children: nodes.map((node) => {
      const { width, height } = getNodeDimensionsForElk(node)
      return {
        id: node.id,
        width,
        height,
      }
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  const layouted = await elk.layout(graph)
  const children = layouted.children
  if (!children?.length) {
    return { nodes }
  }

  const idToPos = new Map(children.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]))

  const nextNodes = nodes.map((node) => {
    const pos = idToPos.get(node.id)
    if (!pos) return node
    return {
      ...node,
      position: { x: pos.x, y: pos.y },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    }
  })

  return { nodes: nextNodes }
}
