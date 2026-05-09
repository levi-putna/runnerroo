"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import {
  workflowConstantsRecordFromRows,
  workflowConstantsRowsFromRecord,
  normaliseWorkflowConstantsJson,
} from "@/lib/workflows/workflow-constants"

export interface WorkflowConstantEditorRow {
  /** Stable React key independent of the logical constant key while typing */
  rowId: string
  key: string
  value: string
}

export interface WorkflowSettingsClientProps {
  workflowId: string
  workflowName: string
  initialConstants: Record<string, string>
}

function randomRowId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function rowsFromRecord({ record }: { record: Record<string, string> }): WorkflowConstantEditorRow[] {
  return workflowConstantsRowsFromRecord({ record }).map((r) => ({
    rowId: randomRowId(),
    key: r.key,
    value: r.value,
  }))
}

/**
 * Workflow Settings UI — manage author-defined constants surfaced as `{{const.*}}` during runs.
 */
export function WorkflowSettingsClient({
  workflowId,
  workflowName,
  initialConstants,
}: WorkflowSettingsClientProps) {
  const router = useRouter()
  const [rows, setRows] = React.useState<WorkflowConstantEditorRow[]>(() => rowsFromRecord({ record: initialConstants }))
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saveBusy, setSaveBusy] = React.useState(false)

  /**
   * Persists the constants map via workflow PATCH (does not touch graph nodes).
   */
  async function handleSave(): Promise<void> {
    setSaveBusy(true)
    setSaveError(null)
    try {
      const record = workflowConstantsRecordFromRows({
        rows: rows.map((r) => ({ key: r.key, value: r.value })),
      })
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_constants: record }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        workflow?: { workflow_constants?: unknown }
      }
      if (!response.ok) {
        setSaveError(typeof body.error === "string" ? body.error : "Could not save settings.")
        return
      }
      if (body.workflow) {
        setRows(
          rowsFromRecord({
            record: normaliseWorkflowConstantsJson(body.workflow.workflow_constants),
          }),
        )
      }
      router.refresh()
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div className="flex flex-col bg-background min-h-0 flex-1">
      {/* Title */}
      <PageHeader title="Workflow settings" description={workflowName}>
        <Link
          href={`/app/workflows/${workflowId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to editor
        </Link>
      </PageHeader>

      {/* Constants */}
      <div className="p-4 pb-12 max-w-3xl mx-auto w-full flex-1 space-y-4">
        <section className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
          <div>
            <h2 className="text-sm font-semibold">Constants</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Static key/value pairs for this workflow. Reference them in any Function input, schema row, or gate value
              as {`{{const.your_key}}`}. Values are plain strings — use them for base URLs, fixed endpoints, shared
              snippets, and anything that should not live on the trigger payload.
            </p>
          </div>

          {saveError !== null ? (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-24 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground text-center py-8">
                      No constants yet — add a row to expose tags such as {`{{const.base_url}}`}.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.rowId}>
                      <TableCell className="align-top">
                        <Input
                          aria-label="Constant key"
                          className="font-mono text-xs h-9"
                          placeholder="base_url"
                          value={row.key}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x.rowId === row.rowId ? { ...x, key: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          aria-label={`Value for ${row.key || "constant"}`}
                          className="text-xs h-9"
                          placeholder="https://api.example.com"
                          value={row.value}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x.rowId === row.rowId ? { ...x, value: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove row"
                          onClick={() =>
                            setRows((prev) => prev.filter((x) => x.rowId !== row.rowId))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                setRows((prev) => [...prev, { rowId: randomRowId(), key: "", value: "" }])
              }
            >
              <Plus className="size-4" aria-hidden />
              Add row
            </Button>
            <Button type="button" size="sm" disabled={saveBusy} onClick={() => void handleSave()}>
              {saveBusy ? "Saving…" : "Save constants"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
