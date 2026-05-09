/**
 * Webhook entry steps share the same evaluation path as invoke triggers (payload fields on
 * `inputSchema` — resolved like a standard step output — plus optional globals).
 */

export { executeEntryNode } from "@/lib/workflows/steps/triggers/invoke/executor"
