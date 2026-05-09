/** Value stored when the workflows list asks the editor to open the manual run modal after navigation */
export const WORKFLOW_OPEN_RUN_INTENT_VALUE = "1"

/**
 * Session storage key signalling "open the toolbar run modal once" for a given workflow (`/app/workflows` row menu → editor).
 *
 * Session storage survives the client navigation but avoids brittle `?run=` handling under React Strict Mode remounts.
 */
export function workflowOpenRunIntentStorageKey({ workflowId }: { workflowId: string }) {
  return `rr-workflow-open-run:v1:${workflowId}`
}
