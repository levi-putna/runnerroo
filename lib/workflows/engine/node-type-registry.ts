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
  Dice3,
  IterationCw,
  FileText,
  PenLine,
  UserCheck,
  UsersRound,
  Send,
} from "lucide-react"

/** React Flow node `type` values used on the workflow canvas. */
export type WorkflowRfNodeType =
  | "entry"
  | "action"
  | "approval"
  | "code"
  | "random"
  | "iteration"
  | "document"
  | "ai"
  | "decision"
  | "switch"
  | "split"
  | "end"
  | "webhookCall"

/** How an entry step is triggered (stored on `data.entryType`). Legacy graphs may still use `manual`. */
export type WorkflowEntryKind = "invoke" | "webhook" | "schedule"

/** AI template discriminator (stored on `data.subtype`). */
export type WorkflowAiSubtype =
  | "generate"
  | "summarize"
  | "classify"
  | "extract"
  | "chat"
  | "transform"

/** Document step discriminator (stored on `data.subtype`). */
export type WorkflowDocumentSubtype = "template" | "docxml"

/** Catalogue section ids for the add-step sheet. */
export type WorkflowStepGroupId =
  | "triggers"
  | "logic"
  | "human"
  | "ai"
  | "code"
  | "documents"
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
  human: { title: "Human", Icon: UsersRound },
  ai: { title: "AI", Icon: Sparkles },
  code: { title: "Code", Icon: Code2 },
  documents: { title: "Documents", Icon: FileText },
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
  invoke: {
    Icon: Play,
    accentBg: "bg-orange-500",
    accentHex: "#f97316",
    canvasBadge: "Invoke",
    defaultLabel: "Invoke workflow",
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
  approval: {
    Icon: UserCheck,
    accentBg: "bg-amber-500",
    accentHex: "#f59e0b",
    typeLabel: "Approval",
  },
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
  random: {
    Icon: Dice3,
    accentBg: "bg-amber-600",
    accentHex: "#d97706",
    typeLabel: "Random number",
  },
  iteration: {
    Icon: IterationCw,
    accentBg: "bg-lime-600",
    accentHex: "#65a30d",
    typeLabel: "Iteration",
  },
  document: {
    Icon: FileText,
    accentBg: "bg-indigo-600",
    accentHex: "#4f46e5",
    typeLabel: "Document step",
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
  webhookCall: {
    Icon: Send,
    accentBg: "bg-blue-600",
    accentHex: "#2563eb",
    typeLabel: "Webhook",
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

/** Shared document step chrome; subtypes swap the glyph + canvas pill. */
export const WORKFLOW_DOCUMENT_FAMILY_META = {
  accentBg: "bg-indigo-600",
  accentHex: "#4f46e5",
  sheetTypeLabel: "Document step",
} as const

export const WORKFLOW_DOCUMENT_SUBTYPE_META: Record<
  WorkflowDocumentSubtype,
  {
    Icon: LucideIcon
    canvasBadge: string
    defaultLabel: string
  }
> = {
  template: {
    Icon: FileText,
    canvasBadge: "Document · Template",
    defaultLabel: "Document from Template",
  },
  docxml: {
    Icon: PenLine,
    canvasBadge: "Document · XML",
    defaultLabel: "Generate document (XML)",
  },
}

export interface ResolveWorkflowNodeTilePresentationParams {
  type: string
  entryType?: string | null
  aiSubtype?: string | null
  documentSubtype?: string | null
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
  documentSubtype,
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

  if (type === "document") {
    const st = normaliseDocumentSubtype({ value: documentSubtype })
    const row = WORKFLOW_DOCUMENT_SUBTYPE_META[st]
    return {
      Icon: row.Icon,
      accentBg: WORKFLOW_DOCUMENT_FAMILY_META.accentBg,
      accentHex: WORKFLOW_DOCUMENT_FAMILY_META.accentHex,
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
 * Maps loose `data.entryType` values to a known entry kind (defaults to invoke).
 * The persisted alias `manual` is treated as invoke so older workflows stay compatible.
 */
export function normaliseEntryKind({ value }: NormaliseEntryKindParams): WorkflowEntryKind {
  if (value === "webhook") return "webhook"
  if (value === "schedule") return "schedule"
  if (value === "manual") return "invoke"
  if (value === "invoke") return "invoke"
  return "invoke"
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

export interface NormaliseDocumentSubtypeParams {
  value?: string | null
}

/**
 * Maps loose `data.subtype` values on document nodes — legacy graphs without the field stay on the template step.
 */
export function normaliseDocumentSubtype({ value }: NormaliseDocumentSubtypeParams): WorkflowDocumentSubtype {
  if (value === "docxml") return "docxml"
  return "template"
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
    case "random":
      return WORKFLOW_NODE_CORE_META.random.typeLabel
    case "iteration":
      return WORKFLOW_NODE_CORE_META.iteration.typeLabel
    case "document":
      return WORKFLOW_DOCUMENT_FAMILY_META.sheetTypeLabel
    case "approval":
      return WORKFLOW_NODE_CORE_META.approval.typeLabel
    case "decision":
      return WORKFLOW_NODE_CORE_META.decision.typeLabel
    case "switch":
      return WORKFLOW_NODE_CORE_META.switch.typeLabel
    case "split":
      return WORKFLOW_NODE_CORE_META.split.typeLabel
    case "end":
      return WORKFLOW_NODE_CORE_META.end.typeLabel
    case "webhookCall":
      return WORKFLOW_NODE_CORE_META.webhookCall.typeLabel
    default:
      return "Node"
  }
}

export interface GetWorkflowCanvasTypeBadgeParams {
  type?: string | null
  entryType?: string | null
  aiSubtype?: string | null
  documentSubtype?: string | null
}

/**
 * Default pill under the node title on the canvas (variant-aware for entry + AI).
 */
export function getWorkflowCanvasTypeBadge({
  type,
  entryType,
  aiSubtype,
  documentSubtype,
}: GetWorkflowCanvasTypeBadgeParams): string {
  if (type === "entry") {
    const kind = normaliseEntryKind({ value: entryType })
    return WORKFLOW_ENTRY_KIND_META[kind].canvasBadge
  }
  if (type === "ai") {
    const st = normaliseAiSubtype({ value: aiSubtype })
    return WORKFLOW_AI_SUBTYPE_META[st].canvasBadge
  }
  if (type === "document") {
    const st = normaliseDocumentSubtype({ value: documentSubtype })
    return WORKFLOW_DOCUMENT_SUBTYPE_META[st].canvasBadge
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
    case "random":
    case "iteration":
      return WORKFLOW_STEP_GROUP_META.code.title
    case "document":
      return WORKFLOW_STEP_GROUP_META.documents.title
    case "action":
    case "webhookCall":
      return WORKFLOW_STEP_GROUP_META.actions.title
    case "approval":
      return WORKFLOW_STEP_GROUP_META.human.title
    case "end":
      return WORKFLOW_STEP_GROUP_META.termination.title
    default:
      return "Workflow"
  }
}
