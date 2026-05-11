import type { ReactNode } from "react"

import { ExpressionVariableTag } from "@/components/site/expression-variable-tag"
import { cn } from "@/lib/utils"

export type { ExpressionVariableTagProps } from "@/components/site/expression-variable-tag"
export { ExpressionVariableTag }

export type LearnDocTwoColumnRow = {
  key: string
  value: ReactNode
  description: ReactNode
  valueCellClassName?: string
}

export type LearnDocTwoColumnTableProps = {
  valueHeader: string
  descriptionHeader: string
  rows: ReadonlyArray<LearnDocTwoColumnRow>
}

/**
 * Shared two-column layout for learn pages (expression tokens, execution fields, and similar references).
 */
export function LearnDocTwoColumnTable({ valueHeader, descriptionHeader, rows }: LearnDocTwoColumnTableProps) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-lg border border-border/80">
      <table className="w-full min-w-[280px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/50">
            <th scope="col" className="px-3 py-2 font-semibold text-foreground">
              {valueHeader}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold text-foreground">
              {descriptionHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/60 last:border-b-0">
              <td className={cn("align-top px-3 py-2.5", row.valueCellClassName)}>{row.value}</td>
              <td className="align-top px-3 py-2.5 text-muted-foreground leading-snug">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export type LearnDocWideTableRow = {
  key: string
  cells: readonly ReactNode[]
  /** Optional class for each cell, aligned with {@link cells} indices. */
  cellClassNames?: readonly string[]
}

export type LearnDocWideTableProps = {
  headers: readonly string[]
  rows: ReadonlyArray<LearnDocWideTableRow>
  /** Extra classes on the table element (e.g. wider minimum for three-column layouts). */
  tableClassName?: string
  /** When true, the last column uses muted body copy like the description column on two-column tables. */
  mutedLastColumn?: boolean
}

/**
 * Multi-column learn tables using the same chrome as {@link LearnDocTwoColumnTable}.
 */
export function LearnDocWideTable({
  headers,
  rows,
  tableClassName,
  mutedLastColumn = true,
}: LearnDocWideTableProps) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-lg border border-border/80">
      <table className={cn("w-full min-w-[280px] border-collapse text-left text-sm", tableClassName)}>
        <thead>
          <tr className="border-b border-border/80 bg-muted/50">
            {headers.map((label) => (
              <th key={label} scope="col" className="px-3 py-2 font-semibold text-foreground">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/60 last:border-b-0">
              {row.cells.map((cell, idx) => {
                const isLast = idx === row.cells.length - 1
                return (
                  <td
                    key={`${row.key}-${idx}`}
                    className={cn(
                      "align-top px-3 py-2.5",
                      mutedLastColumn && isLast ? "text-muted-foreground leading-snug" : null,
                      row.cellClassNames?.[idx],
                    )}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export type LearnExprVarTableRow = {
  id: string
  description: ReactNode
  /** Optional palette label, shown in bold before the description (system tags on the expressions learn page). */
  label?: string
}

export type LearnExprVarTableProps = {
  rows: ReadonlyArray<LearnExprVarTableRow>
  /**
   * When "pill", each value is a light purple monospace chip; otherwise purple monospace text on the cell.
   */
  variant?: "plain" | "pill"
}

/**
 * Expression variable tokens: purple monospace value column plus description (same pattern as the Run code learn page).
 */
export function LearnExprVarTable({ rows, variant = "plain" }: LearnExprVarTableProps) {
  return (
    <LearnDocTwoColumnTable
      valueHeader="Value"
      descriptionHeader="Description"
      rows={rows.map((row) => ({
        key: row.id,
        value: <ExpressionVariableTag id={row.id} size="xs" variant={variant} />,
        valueCellClassName: "align-top",
        description:
          row.label != null && row.label !== "" ? (
            <>
              <strong className="text-foreground">{row.label}</strong> {row.description}
            </>
          ) : (
            row.description
          ),
      }))}
    />
  )
}

