import type { Node } from "@xyflow/react"

import {
  normaliseEntryKind,
  type WorkflowEntryKind,
} from "@/lib/workflows/engine/node-type-registry"
import { resolveWorkflowEntryNodeId } from "@/lib/workflows/engine/runner"

/** Row-level trigger metadata synced from the persisted entry step. */
export type DerivedWorkflowTrigger = {
  trigger_type: "manual" | "webhook" | "cron"
  trigger_config: Record<string, unknown>
}

/**
 * Computes `workflows.trigger_type` and `workflows.trigger_config` from React Flow nodes.
 * Mirrors the canonical entry node resolver used during execution ({@link resolveWorkflowEntryNodeId}).
 */
export function deriveWorkflowTriggerFromRfNodes({ nodes }: { nodes: Node[] }): DerivedWorkflowTrigger {
  const entryId = resolveWorkflowEntryNodeId({ nodes })
  if (!entryId) {
    return { trigger_type: "manual", trigger_config: {} }
  }

  const entry = nodes.find((n) => n.id === entryId)
  if (!entry || entry.type !== "entry") {
    return { trigger_type: "manual", trigger_config: {} }
  }

  const data = entry.data as Record<string, unknown> | undefined
  const kind: WorkflowEntryKind = normaliseEntryKind({
    value: typeof data?.entryType === "string" ? data.entryType : undefined,
  })

  if (kind === "webhook") {
    const pathRaw = typeof data?.webhookPath === "string" ? data.webhookPath.trim() : ""
    const path = normaliseWebhookPathSegment({ segment: pathRaw })
    return {
      trigger_type: "webhook",
      trigger_config: {
        type: "webhook",
        path,
        method: "POST",
      },
    }
  }

  if (kind === "schedule") {
    const schedule = typeof data?.schedule === "string" ? data.schedule.trim() : ""
    const timezoneRaw = typeof data?.timezone === "string" ? data.timezone.trim() : ""
    const timezone = timezoneRaw !== "" ? timezoneRaw : "UTC"
    return {
      trigger_type: "cron",
      trigger_config: {
        type: "cron",
        schedule,
        timezone,
      },
    }
  }

  return { trigger_type: "manual", trigger_config: {} }
}

function normaliseWebhookPathSegment({ segment }: { segment: string }): string {
  const s = segment === "" ? "/webhook" : segment
  if (s.startsWith("/")) return s
  return `/${s}`
}
