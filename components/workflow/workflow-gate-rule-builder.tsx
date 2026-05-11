"use client"

import * as React from "react"
import { GitBranch, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExpressionInput } from "@/components/workflow/expression-input"
import { PromptTagFieldSelect } from "@/components/workflow/prompt-tag-field-select"
import { mergePromptTagDefinitions, type PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"
import {
  type GateGroup,
  type GateRule,
  type GateOperator,
  GATE_OPERATOR_META,
  createEmptyGateRule,
} from "@/lib/workflows/engine/gate-rule"

// ─── Operator selector ────────────────────────────────────────────────────────

interface OperatorSelectProps {
  value: GateOperator
  onChange: ({ value }: { value: GateOperator }) => void
  ruleId: string
}

/**
 * Gate operator picker — flat list in a sensible conceptual order.
 */
function OperatorSelect({ value, onChange, ruleId }: OperatorSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange({ value: v as GateOperator })}>
      <SelectTrigger id={`gate-op-${ruleId}`} className="h-8 min-w-0 w-full text-xs">
        <SelectValue placeholder="Operator…" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>Comparison</SelectLabel>
          {(["equals", "not_equals"] as GateOperator[]).map((op) => (
            <SelectItem key={op} value={op}>
              {GATE_OPERATOR_META[op].label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Numbers</SelectLabel>
          {(["gt", "gte", "lt", "lte"] as GateOperator[]).map((op) => (
            <SelectItem key={op} value={op}>
              {GATE_OPERATOR_META[op].label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Text</SelectLabel>
          {(["contains", "not_contains", "starts_with", "ends_with"] as GateOperator[]).map((op) => (
            <SelectItem key={op} value={op}>
              {GATE_OPERATOR_META[op].label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Presence</SelectLabel>
          {(["is_empty", "is_not_empty", "is_true", "is_false"] as GateOperator[]).map((op) => (
            <SelectItem key={op} value={op}>
              {GATE_OPERATOR_META[op].label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

// ─── AND / ANY logic toggle ───────────────────────────────────────────────────

interface LogicToggleProps {
  logic: "and" | "or"
  onChange: ({ logic }: { logic: "and" | "or" }) => void
}

/**
 * Inline pill to switch between "Match ALL" and "Match ANY" for a rule group.
 */
function LogicToggle({ logic, onChange }: LogicToggleProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Match</span>
      <Select value={logic} onValueChange={(v) => onChange({ logic: v as "and" | "or" })}>
        <SelectTrigger className="h-6 w-[68px] rounded-full border-border/70 bg-muted/40 px-2.5 text-[11px] font-semibold text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="center" alignItemWithTrigger={false}>
          <SelectItem value="and">ALL</SelectItem>
          <SelectItem value="or">ANY</SelectItem>
        </SelectContent>
      </Select>
      <span>of these conditions:</span>
    </div>
  )
}

// ─── Single rule row ─────────────────────────────────────────────────────────

interface GateRuleRowProps {
  rule: GateRule
  /** Index within the group — used to show the AND / OR badge between rows. */
  index: number
  logic: "and" | "or"
  canRemove: boolean
  upstreamTags: PromptTagDefinition[]
  onChangeField: ({ ruleId, value }: { ruleId: string; value: string }) => void
  onChangeOperator: ({ ruleId, value }: { ruleId: string; value: GateOperator }) => void
  onChangeValue: ({ ruleId, value }: { ruleId: string; value: string }) => void
  onRemove: ({ ruleId }: { ruleId: string }) => void
}

/**
 * One condition row — bordered list row aligned with {@link WorkflowEditableListRow} styling.
 * A connector badge ("AND" / "OR") appears above rows after the first.
 */
function GateRuleRow({
  rule,
  index,
  logic,
  canRemove,
  upstreamTags,
  onChangeField,
  onChangeOperator,
  onChangeValue,
  onRemove,
}: GateRuleRowProps) {
  const meta = GATE_OPERATOR_META[rule.operator]
  const needsValue = meta?.needsValue ?? true
  const mergedTags = React.useMemo(() => mergePromptTagDefinitions({ contextual: upstreamTags }), [upstreamTags])

  const labelClass =
    "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"

  return (
    <div className="space-y-2">
      {/* Join label between stacked condition rows — rhythm matches schema list spacing */}
      {index > 0 ? (
        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="h-px flex-1 bg-border/70" />
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
              logic === "and"
                ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                : "border-amber-500/30 bg-amber-500/10 text-amber-600",
            )}
          >
            {logic === "and" ? "AND" : "OR"}
          </span>
          <div className="h-px flex-1 bg-border/70" />
        </div>
      ) : null}

      {/* Row chrome aligned with {@link WorkflowEditableListRow} lists */}
      <div
        className={cn(
          "group flex min-w-0 w-full flex-col gap-2 rounded-lg border border-border/70 bg-background px-3 py-2.5 transition-colors",
          "focus-within:ring-2 focus-within:ring-ring hover:bg-muted/30",
        )}
      >
        {/* Field | operator | delete rail */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-[min(100%,11rem)] space-y-1">
            <Label htmlFor={`gate-field-${rule.id}`} className={labelClass}>
              Field
            </Label>
            <PromptTagFieldSelect
              id={`gate-field-${rule.id}`}
              value={rule.field}
              onChange={({ value }) => onChangeField({ ruleId: rule.id, value })}
              tags={upstreamTags}
            />
          </div>

          <div className="min-w-0 flex-1 basis-[min(100%,10rem)] space-y-1">
            <Label htmlFor={`gate-op-${rule.id}`} className={labelClass}>
              Condition
            </Label>
            <OperatorSelect
              value={rule.operator}
              onChange={({ value }) => onChangeOperator({ ruleId: rule.id, value })}
              ruleId={rule.id}
            />
          </div>

          {/* Delete — hover / focus-within reveal like schema list rows */}
          <div
            className={cn(
              "flex shrink-0 items-end pb-0.5 opacity-0 pointer-events-none transition-opacity duration-150",
              "group-hover:pointer-events-auto group-hover:opacity-100",
              "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!canRemove}
              onClick={() => onRemove({ ruleId: rule.id })}
              aria-label="Remove condition"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        {/* Value row */}
        {needsValue ? (
          <div className="space-y-1">
            <Label className={labelClass}>Value</Label>
            <ExpressionInput
              tags={mergedTags}
              value={rule.value}
              onChange={({ value }) => onChangeValue({ ruleId: rule.id, value })}
              fieldInstanceId={`gate-val-${rule.id}`}
              placeholder="literal or {{tag}}"
              rows={1}
              className="[&_.expression-input-editor-focus-surface]:min-h-0"
            />
          </div>
        ) : (
          <p className="text-[11px] italic text-muted-foreground">No value needed for this condition.</p>
        )}
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface WorkflowGateRuleBuilderProps {
  /** Unique stable id for this builder instance — used for aria labels. */
  builderId: string
  /** Current gate group (logic + rules). */
  group: GateGroup
  /** Fires with the updated group whenever anything changes. */
  onChange: ({ group }: { group: GateGroup }) => void
  /** Available tag tokens from the inbound predecessor and step input schema. */
  upstreamTags: PromptTagDefinition[]
}

/**
 * Visual rule-row builder for workflow logic gates (Decision and Switch).
 *
 * Renders a shell consistent with {@link InputSchemaBuilder} plus:
 * - AND / ANY logic toggle
 * - A stacked list of condition rows (same bordered row chrome as schema lists)
 * - Subtle AND/OR join markers between rows
 * - Add condition control
 *
 * The caller is responsible for compiling the resulting `GateGroup` to a JS
 * expression (`compileGateGroupToExpression`) and writing it to `data.condition`.
 */
export function WorkflowGateRuleBuilder({
  builderId,
  group,
  onChange,
  upstreamTags,
}: WorkflowGateRuleBuilderProps) {
  const { logic, rules } = group

  function commit({ next }: { next: GateGroup }) {
    onChange({ group: next })
  }

  function handleLogicChange({ logic: nextLogic }: { logic: "and" | "or" }) {
    commit({ next: { ...group, logic: nextLogic } })
  }

  function handleAddRule() {
    commit({ next: { ...group, rules: [...rules, createEmptyGateRule()] } })
  }

  function handleRemoveRule({ ruleId }: { ruleId: string }) {
    if (rules.length <= 1) return
    commit({ next: { ...group, rules: rules.filter((r) => r.id !== ruleId) } })
  }

  function patchRule({ ruleId, patch }: { ruleId: string; patch: Partial<GateRule> }) {
    commit({
      next: {
        ...group,
        rules: rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      },
    })
  }

  return (
    <div
      className="min-w-0 w-full overflow-hidden rounded-xl border border-border/80 bg-card/40"
      aria-label={`Gate conditions builder ${builderId}`}
    >
      {/* Header — mirrors InputSchemaBuilder shell */}
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background"
          aria-hidden
        >
          <GitBranch className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold leading-none tracking-tight text-foreground">
            Route conditions
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Evaluated top to bottom. Use{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">input.*</code> for
            the previous step&apos;s output,{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">trigger_inputs.*</code>{" "}
            for the original workflow invoke payload, and{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">global.*</code> for
            shared workflow state.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4 pt-3">
        {/* AND / ANY toggle */}
        {rules.length > 1 ? (
          <LogicToggle logic={logic} onChange={handleLogicChange} />
        ) : null}

        {/* Empty state */}
        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            No conditions yet. Add a condition below.
          </p>
        ) : null}

        {/* Condition rows — spaced like Output schema / globals lists */}
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <GateRuleRow
              key={rule.id}
              rule={rule}
              index={idx}
              logic={logic}
              canRemove={rules.length > 1}
              upstreamTags={upstreamTags}
              onChangeField={({ ruleId, value }) => patchRule({ ruleId, patch: { field: value } })}
              onChangeOperator={({ ruleId, value }) =>
                patchRule({ ruleId, patch: { operator: value } })
              }
              onChangeValue={({ ruleId, value }) => patchRule({ ruleId, patch: { value } })}
              onRemove={handleRemoveRule}
            />
          ))}
        </div>

        {/* Add condition */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleAddRule}
        >
          <Plus className="size-4" aria-hidden />
          Add condition
        </Button>

        {/* Logic summary */}
        {rules.length > 1 ? (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {logic === "and"
              ? "ALL conditions must be true to take this path."
              : "ANY one condition being true is enough to take this path."}
          </p>
        ) : null}
      </div>
    </div>
  )
}
