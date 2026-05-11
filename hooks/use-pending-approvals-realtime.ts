"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type WorkflowApprovalRow = Database["public"]["Tables"]["workflow_approvals"]["Row"]

/** Shape from `realtime.broadcast_changes()` for INSERT (see Supabase Realtime broadcast payloads). */
type WorkflowApprovalBroadcastInsertPayload = {
  record: WorkflowApprovalRow
  old_record: null
}

/** Shape from `realtime.broadcast_changes()` for UPDATE. */
type WorkflowApprovalBroadcastUpdatePayload = {
  record: WorkflowApprovalRow
  old_record: WorkflowApprovalRow
}

/** Shape from `realtime.broadcast_changes()` for DELETE. */
type WorkflowApprovalBroadcastDeletePayload = {
  record: null
  old_record: WorkflowApprovalRow
}

/**
 * Applies the signed-in session JWT to the Realtime websocket so private-channel RLS policies run as this user.
 */
async function syncRealtimeAuth({
  supabase,
}: {
  supabase: ReturnType<typeof createClient>
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    await supabase.realtime.setAuth(session.access_token)
  } else {
    await supabase.realtime.setAuth(null)
  }
}

/**
 * Computes the change in the count of **pending** approvals from a broadcast payload.
 */
function pendingCountDeltaFromInsert({
  payload,
}: {
  payload: WorkflowApprovalBroadcastInsertPayload
}) {
  return payload.record.status === "pending" ? 1 : 0
}

/**
 * Computes the change in the count of **pending** approvals from a broadcast payload.
 */
function pendingCountDeltaFromUpdate({
  payload,
}: {
  payload: WorkflowApprovalBroadcastUpdatePayload
}) {
  const wasPending = payload.old_record.status === "pending"
  const isPending = payload.record.status === "pending"
  if (wasPending && !isPending) return -1
  if (!wasPending && isPending) return 1
  return 0
}

/**
 * Computes the change in the count of **pending** approvals from a broadcast payload.
 */
function pendingCountDeltaFromDelete({
  payload,
}: {
  payload: WorkflowApprovalBroadcastDeletePayload
}) {
  return payload.old_record.status === "pending" ? -1 : 0
}

/**
 * Whether this INSERT introduces a new pending approval for the reviewer.
 */
function shouldToastAfterInsert({
  payload,
}: {
  payload: WorkflowApprovalBroadcastInsertPayload
}) {
  return payload.record.status === "pending"
}

/**
 * Whether this UPDATE moves an approval into the pending state for the reviewer.
 */
function shouldToastAfterUpdate({
  payload,
}: {
  payload: WorkflowApprovalBroadcastUpdatePayload
}) {
  const wasPending = payload.old_record.status === "pending"
  const isPending = payload.record.status === "pending"
  return !wasPending && isPending
}

function toastNewApprovalIfNeeded({
  payloadRecordTitle,
  shouldToast,
  isOnInboxRoute,
}: {
  payloadRecordTitle: string | undefined | null
  shouldToast: boolean
  isOnInboxRoute: boolean
}) {
  if (!shouldToast || isOnInboxRoute) return

  const title =
    typeof payloadRecordTitle === "string" && payloadRecordTitle.trim() !== ""
      ? payloadRecordTitle.trim()
      : "Approval required"

  toast.info("Something needs your review", {
    description: title,
    action: {
      label: "Open inbox",
      onClick: () => {
        window.location.assign("/app/inbox")
      },
    },
  })
}

/**
 * Subscribes to Supabase Realtime **broadcast** events for `workflow_approvals` on a private per-user channel.
 * Keeps the inbox badge count in sync and surfaces an optional Sonner toast when a new pending approval arrives.
 */
export function usePendingApprovalsRealtime({
  userId,
  initialCount,
}: {
  userId: string
  initialCount: number
}) {
  const pathname = usePathname()
  const pathnameRef = React.useRef(pathname)

  React.useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const [pendingCount, setPendingCount] = React.useState(initialCount)

  React.useEffect(() => {
    // Reset to the server-computed count when the authenticated layout recomputes (e.g. navigation refresh).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from server props to client state
    setPendingCount(initialCount)
  }, [initialCount])

  React.useEffect(() => {
    const supabase = createClient()
    const topic = `approvals:${userId}`
    let cancelled = false
    let authSub: { unsubscribe: () => void } | undefined

    const channel = supabase
      .channel(topic, {
        config: { private: true },
      })
      .on("broadcast", { event: "INSERT" }, (envelope) => {
        const payload = envelope.payload as WorkflowApprovalBroadcastInsertPayload
        const delta = pendingCountDeltaFromInsert({ payload })
        if (delta !== 0) {
          setPendingCount((c) => Math.max(0, c + delta))
        }
        toastNewApprovalIfNeeded({
          payloadRecordTitle: payload.record.title,
          shouldToast: shouldToastAfterInsert({ payload }),
          isOnInboxRoute: pathnameRef.current?.startsWith("/app/inbox") ?? false,
        })
      })
      .on("broadcast", { event: "UPDATE" }, (envelope) => {
        const payload = envelope.payload as WorkflowApprovalBroadcastUpdatePayload
        const delta = pendingCountDeltaFromUpdate({ payload })
        if (delta !== 0) {
          setPendingCount((c) => Math.max(0, c + delta))
        }
        toastNewApprovalIfNeeded({
          payloadRecordTitle: payload.record.title,
          shouldToast: shouldToastAfterUpdate({ payload }),
          isOnInboxRoute: pathnameRef.current?.startsWith("/app/inbox") ?? false,
        })
      })
      .on("broadcast", { event: "DELETE" }, (envelope) => {
        const payload = envelope.payload as WorkflowApprovalBroadcastDeletePayload
        const delta = pendingCountDeltaFromDelete({ payload })
        if (delta !== 0) {
          setPendingCount((c) => Math.max(0, c + delta))
        }
      })

    void (async () => {
      await syncRealtimeAuth({ supabase })
      if (cancelled) return

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session || session.user.id !== userId) {
        void supabase.removeChannel(channel)
        return
      }

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        void supabase.realtime.setAuth(nextSession?.access_token ?? null)
      })
      authSub = data.subscription

      if (cancelled) {
        authSub.unsubscribe()
        return
      }

      await channel.subscribe()
    })()

    return () => {
      cancelled = true
      authSub?.unsubscribe()
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return { pendingCount }
}
