/**
 * Scheduled entry steps share the same evaluation path as invoke triggers (`inputSchema` field rows
 * drive the outbound payload, plus optional globals).
 */

export { executeEntryNode } from "@/lib/workflows/steps/triggers/invoke/executor"
