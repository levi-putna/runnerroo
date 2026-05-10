import { getAiGatewayModelListCached } from "@/lib/ai-gateway/gateway-raw-models"
import { gatewayV1ModelsResponseToGatewayModels } from "@/lib/ai-gateway/map-gateway-v1-models-response"
import { GATEWAY_MODELS } from "@/lib/ai-gateway/models"
import type { GatewayModel } from "@/lib/ai-gateway/types"

/**
 * Loads normalised gateway models via the same in-memory cache as other server code
 * ({@link getAiGatewayModelListCached}), falling back to the static {@link GATEWAY_MODELS} list on failure.
 */
export async function getCatalogueGatewayModelsOrFallback(): Promise<GatewayModel[]> {
  try {
    const raw = await getAiGatewayModelListCached()
    return gatewayV1ModelsResponseToGatewayModels({ body: { object: "list", data: raw } })
  } catch {
    return GATEWAY_MODELS.slice()
  }
}
