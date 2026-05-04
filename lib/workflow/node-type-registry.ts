import type { LucideIcon } from "lucide-react"
import {
  Play,
  Webhook,
  Clock,
  Zap,
  Code2,
  GitBranch,
  GitFork,
  Split,
  CircleStop,
  Sparkles,
  AlignLeft,
  Tag,
  ScanSearch,
  MessageSquare,
  Wand2,
  Workflow,
  Wrench,
} from "lucide-react"

/** React Flow node `type` values used on the workflow canvas. */
export type WorkflowRfNodeType =
  | "entry"
  | "action"
  | "code"
  | "ai"
  | "decision"
  | "switch"
  | "split"
  | "end"

/** How an entry step is triggered (stored on `data.entryType`). */
export type WorkflowEntryKind = "manual" | "webhook" | "schedule"

/** AI template discriminator (stored on `data.subtype`). */
export type WorkflowAiSubtype =
  | "generate"
  | "summarize"
  | "classify"
  | "extract"
  | "chat"
  | "transform"

/** Catalogue section ids for the add-step sheet. */
export type WorkflowStepGroupId =
  | "triggers"
  | "logic"
  | "ai"
  | "code"
  | "actions"
  | "termination"

/** Lucide stroke scale for small tiles vs sheet header. */
export type WorkflowGlyphStroke = "default" | "emphasis"

export const WORKFLOW_GLYPH_SIZE_CLASSES = {
  sm: "size-3",
  md: "size-4",
  lg: "size-6",
  /** Decision / switch hero tiles on the canvas */
  hero: "size-5",
  /** End node disc */
  endDisc: "size-[22px]",
} as const

export type WorkflowGlyphSize = keyof typeof WORKFLOW_GLYPH_SIZE_CLASSES

/** Heading row in the add-step sheet: neutral tile + group title. */
export const WORKFLOW_STEP_GROUP_META: Record<
  WorkflowStepGroupId,
  { title: string; Icon: LucideIcon }
> = {
  triggers: { title: "Triggers", Icon: Zap },
  logic: { title: "Logic", Icon: Workflow },
  ai: { title: "AI", Icon: Sparkles },
  code: { title: "Code", Icon: Code2 },
  actions: { title: "Actions", Icon: Wrench },
  termination: { title: "Termination", Icon: CircleStop },
}

/** Per-trigger variant: icon, colours, and copy used on canvas + picker. */
export const WORKFLOW_ENTRY_KIND_META: Record<
  WorkflowEntryKind,
  {
    Icon: LucideIcon
    accentBg: string
    accentHex: string
    canvasBadge: string
    defaultLabel: string
    /** Extra classes on the glyph (e.g. filled play). */
    glyphClassName?: string
  }
> = {
  manual: {
    Icon: Play,
    accentBg: "bg-orange-500",
    accentHex: "#f97316",
    canvasBadge: "Trigger",
    defaultLabel: "Manual run",
    glyphClassName: "fill-white",
  },
  webhook: {
    Icon: Webhook,
    accentBg: "bg-purple-500",
    accentHex: "#a855f7",
    canvasBadge: "Webhook",
    defaultLabel: "Webhook",
  },
  schedule: {
    Icon: Clock,
    accentBg: "bg-blue-500",
    accentHex: "#3b82f6",
    canvasBadge: "Schedule",
    defaultLabel: "Schedule",
  },
}

/** Node kinds without canvas sub-variants (single icon + accent). */
export const WORKFLOW_NODE_CORE_META: Record<
  Exclude<WorkflowRfNodeType, "entry" | "ai">,
  {
    Icon: LucideIcon
    accentBg: string
    accentHex: string
    /** Shown in the node sheet type badge and as the default canvas pill where applicable. */
    typeLabel: string
  }
> = {
  action: {
    Icon: Zap,
    accentBg: "bg-emerald-500",
    accentHex: "#10b981",
    typeLabel: "Action",
  },
  code: {
    Icon: Code2,
    accentBg: "bg-slate-700",
    accentHex: "#334155",
    typeLabel: "Code",
  },
  decision: {
    Icon: GitBranch,
    accentBg: "bg-sky-500",
    accentHex: "#0ea5e9",
    typeLabel: "Decision",
  },
  switch: {
    Icon: GitFork,
    accentBg: "bg-teal-600",
    accentHex: "#0d9488",
    typeLabel: "Switch",
  },
  split: {
    Icon: Split,
    accentBg: "bg-cyan-600",
    accentHex: "#0891b2",
    typeLabel: "Split",
  },
  end: {
    Icon: CircleStop,
    accentBg: "bg-rose-600",
    accentHex: "#e11d48",
    typeLabel: "End",
  },
}

/** Shared AI step chrome; subtypes only swap the glyph + canvas pill. */
export const WORKFLOW_AI_FAMILY_META = {
  accentBg: "bg-violet-600",
  accentHex: "#7c3aed",
  sheetTypeLabel: "AI step",
} as const

export const WORKFLOW_AI_SUBTYPE_META: Record<
  WorkflowAiSubtype,
  {
    Icon: LucideIcon
    /** Pill under the title on the canvas. */
    canvasBadge: string
    defaultLabel: string
  }
> = {
  generate: {
    Icon: Sparkles,
    canvasBadge: "AI · Generate",
    defaultLabel: "Generate text",
  },
  summarize: {
    Icon: AlignLeft,
    canvasBadge: "AI · Summarise",
    defaultLabel: "Summarise content",
  },
  classify: {
    Icon: Tag,
    canvasBadge: "AI · Classify",
    defaultLabel: "Classify input",
  },
  extract: {
    Icon: ScanSearch,
    canvasBadge: "AI · Extract",
    defaultLabel: "Extract data",
  },
  chat: {
    Icon: MessageSquare,
    canvasBadge: "AI · Chat",
    defaultLabel: "Chat completion",
  },
  transform: {
    Icon: Wand2,
    canvasBadge: "AI · Transform",
    defaultLabel: "Transform data",
  },
}

export interface ResolveWorkflowNodeTilePresentationParams {
  type: string
  entryType?: string | null
  aiSubtype?: string | null
}

export interface WorkflowNodeTilePresentation {
  Icon: LucideIcon
  accentBg: string
  accentHex: string
  glyphClassName?: string
}

/**
 * Resolves icon + accent colours for a coloured tile (add sheet, canvas header, node sheet).
 */
export function resolveWorkflowNodeTilePresentation({
  type,
  entryType,
  aiSubtype,
}: ResolveWorkflowNodeTilePresentationParams): WorkflowNodeTilePresentation {
  if (type === "entry") {
    const kind = normaliseEntryKind({ value: entryType })
    const row = WORKFLOW_ENTRY_KIND_META[kind]
    return {
      Icon: row.Icon,
      accentBg: row.accentBg,
      accentHex: row.accentHex,
      glyphClassName: row.glyphClassName,
    }
  }

  if (type === "ai") {
    const st = normaliseAiSubtype({ value: aiSubtype })
    const row = WORKFLOW_AI_SUBTYPE_META[st]
    return {
      Icon: row.Icon,
      accentBg: WORKFLOW_AI_FAMILY_META.accentBg,
      accentHex: WORKFLOW_AI_FAMILY_META.accentHex,
    }
  }

  const core = WORKFLOW_NODE_CORE_META[type as keyof typeof WORKFLOW_NODE_CORE_META]
  if (core) {
    return {
      Icon: core.Icon,
      accentBg: core.accentBg,
      accentHex: core.accentHex,
    }
  }

  return {
    Icon: Zap,
    accentBg: "bg-slate-500",
    accentHex: "#64748b",
  }
}

export interface NormaliseEntryKindParams {
  value?: string | null
}

/**
 * Maps loose `data.entryType` values to a known entry kind (defaults to manual).
 */
export function normaliseEntryKind({ value }: NormaliseEntryKindParams): WorkflowEntryKind {
  if (value === "webhook") return "webhook"
  if (value === "schedule") return "schedule"
  return "manual"
}

export interface NormaliseAiSubtypeParams {
  value?: string | null
}

/**
 * Maps loose `data.subtype` values to a known AI template (defaults to generate).
 */
export function normaliseAiSubtype({ value }: NormaliseAiSubtypeParams): WorkflowAiSubtype {
  const allowed = Object.keys(WORKFLOW_AI_SUBTYPE_META) as WorkflowAiSubtype[]
  if (value && allowed.includes(value as WorkflowAiSubtype)) return value as WorkflowAiSubtype
  return "generate"
}

export interface GetWorkflowSheetTypeLabelParams {
  type?: string | null
}

/**
 * Short type line shown in the node sheet badge (family name, not per-template titles).
 */
export function getWorkflowSheetTypeLabel({ type }: GetWorkflowSheetTypeLabelParams): string {
  switch (type) {
    case "entry":
      return "Entry"
    case "ai":
      return WORKFLOW_AI_FAMILY_META.sheetTypeLabel
    case "action":
      return WORKFLOW_NODE_CORE_META.action.typeLabel
    case "code":
      return WORKFLOW_NODE_CORE_META.code.typeLabel
    case "decision":
      return WORKFLOW_NODE_CORE_META.decision.typeLabel
    case "switch":
      return WORKFLOW_NODE_CORE_META.switch.typeLabel
    case "split":
      return WORKFLOW_NODE_CORE_META.split.typeLabel
    case "end":
      return WORKFLOW_NODE_CORE_META.end.typeLabel
    default:
      return "Node"
  }
}

export interface GetWorkflowCanvasTypeBadgeParams {
  type?: string | null
  entryType?: string | null
  aiSubtype?: string | null
}

/**
 * Default pill under the node title on the canvas (variant-aware for entry + AI).
 */
export function getWorkflowCanvasTypeBadge({
  type,
  entryType,
  aiSubtype,
}: GetWorkflowCanvasTypeBadgeParams): string {
  if (type === "entry") {
    const kind = normaliseEntryKind({ value: entryType })
    return WORKFLOW_ENTRY_KIND_META[kind].canvasBadge
  }
  if (type === "ai") {
    const st = normaliseAiSubtype({ value: aiSubtype })
    return WORKFLOW_AI_SUBTYPE_META[st].canvasBadge
  }
  if (type && type in WORKFLOW_NODE_CORE_META) {
    return WORKFLOW_NODE_CORE_META[type as keyof typeof WORKFLOW_NODE_CORE_META].typeLabel
  }
  return "Step"
}

export interface GetWorkflowMinimapNodeColourParams {
  type?: string | null
  data?: Record<string, unknown> | null
}

/**
 * MiniMap swatch colour — entry respects `entryType`; other kinds use family hex.
 */
export function getWorkflowMinimapNodeColour({
  type,
  data,
}: GetWorkflowMinimapNodeColourParams): string {
  const d = data ?? {}
  if (type === "entry") {
    const kind = normaliseEntryKind({ value: d.entryType as string | undefined })
    return WORKFLOW_ENTRY_KIND_META[kind].accentHex
  }
  if (type === "ai") return WORKFLOW_AI_FAMILY_META.accentHex
  if (type && type in WORKFLOW_NODE_CORE_META) {
    return WORKFLOW_NODE_CORE_META[type as keyof typeof WORKFLOW_NODE_CORE_META].accentHex
  }
  return WORKFLOW_NODE_CORE_META.action.accentHex
}

export interface GetWorkflowNodeCategoryLabelParams {
  type?: string | null
}

/**
 * High-level category string for filters and documentation (not currently shown on canvas cards).
 */
export function getWorkflowNodeCategoryLabel({ type }: GetWorkflowNodeCategoryLabelParams): string {
  switch (type) {
    case "entry":
      return WORKFLOW_STEP_GROUP_META.triggers.title
    case "decision":
    case "switch":
    case "split":
      return WORKFLOW_STEP_GROUP_META.logic.title
    case "ai":
      return WORKFLOW_STEP_GROUP_META.ai.title
    case "code":
      return WORKFLOW_STEP_GROUP_META.code.title
    case "action":
      return WORKFLOW_STEP_GROUP_META.actions.title
    case "end":
      return WORKFLOW_STEP_GROUP_META.termination.title
    default:
      return "Workflow"
  }
}
