import type { Edge, Node } from "@xyflow/react"

/**
 * Default graph shown for a brand-new workflow (single invoke entry node).
 */
export function defaultWorkflowCanvasNodes(): Node[] {
  return [
    {
      id: "entry-1",
      type: "entry",
      position: { x: 300, y: 60 },
      data: { label: "Invoke workflow", entryType: "invoke" },
    },
  ]
}

/**
 * Strips React Flow runtime fields so graphs round-trip cleanly through JSON storage.
 */
export function toPersistableNodes(nodes: Node[]): Record<string, unknown>[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    ...(n.width != null && n.height != null
      ? { width: n.width, height: n.height }
      : {}),
  }))
}

/**
 * Serialises edges for persistence (omits selection / interaction state).
 */
export function toPersistableEdges(edges: Edge[]): Record<string, unknown>[] {
  return edges.map((e) => ({
    id: e.id,
    type: e.type,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    animated: e.animated,
    style: e.style,
    label: e.label,
  }))
}

/**
 * Parses stored JSON into React Flow nodes (best-effort; invalid entries dropped).
 */
export function parseWorkflowNodes(raw: unknown): Node[] {
  if (!Array.isArray(raw)) return []
  const out: Node[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === "string" ? o.id : null
    const type = typeof o.type === "string" ? o.type : "action"
    const position =
      o.position && typeof o.position === "object"
        ? (o.position as { x?: number; y?: number })
        : {}
    const x = typeof position.x === "number" ? position.x : 0
    const y = typeof position.y === "number" ? position.y : 0
    if (!id) continue
    const width = typeof o.width === "number" ? o.width : undefined
    const height = typeof o.height === "number" ? o.height : undefined
    out.push({
      id,
      type,
      position: { x, y },
      data: (typeof o.data === "object" && o.data !== null ? o.data : {}) as Node["data"],
      ...(width != null && height != null ? { width, height } : {}),
    })
  }
  return out
}

/**
 * Parses stored JSON into React Flow edges.
 */
export function parseWorkflowEdges(raw: unknown): Edge[] {
  if (!Array.isArray(raw)) return []
  const out: Edge[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === "string" ? o.id : null
    const source = typeof o.source === "string" ? o.source : null
    const target = typeof o.target === "string" ? o.target : null
    if (!id || !source || !target) continue
    out.push({
      id,
      source,
      target,
      type: typeof o.type === "string" ? o.type : "workflow",
      sourceHandle: typeof o.sourceHandle === "string" ? o.sourceHandle : undefined,
      targetHandle: typeof o.targetHandle === "string" ? o.targetHandle : undefined,
      animated: typeof o.animated === "boolean" ? o.animated : undefined,
      style: typeof o.style === "object" && o.style !== null ? (o.style as Edge["style"]) : undefined,
      label: o.label as Edge["label"],
    })
  }
  return out
}

/**
 * Stable string for dirty-checking the graph only (excludes workflow title).
 */
export function workflowGraphBaseline({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const n = toPersistableNodes(nodes)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const e = toPersistableEdges(edges)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return JSON.stringify({ nodes: n, edges: e })
}

/**
 * Stable string for dirty-checking editor state (name + graph).
 */
export function workflowEditorBaseline({ name, nodes, edges }: { name: string; nodes: Node[]; edges: Edge[] }) {
  return JSON.stringify({
    name: name.trim(),
    graph: workflowGraphBaseline({ nodes, edges }),
  })
}
