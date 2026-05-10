import type { GatewayModel } from "@/lib/ai-gateway/types"

/**
 * Returns true when a trimmed lower-case query matches the model id, display name, provider label, or provider key.
 */
export function gatewayModelMatchesSearchQuery({
  model,
  queryLower,
}: {
  model: GatewayModel
  queryLower: string
}): boolean {
  if (!queryLower.length) return true
  return (
    model.id.toLowerCase().includes(queryLower) ||
    model.shortName.toLowerCase().includes(queryLower) ||
    model.providerLabel.toLowerCase().includes(queryLower) ||
    model.providerKey.toLowerCase().includes(queryLower)
  )
}
