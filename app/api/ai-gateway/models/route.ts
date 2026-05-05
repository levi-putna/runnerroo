import { NextResponse } from "next/server";

import { gatewayV1ModelsResponseToGatewayModels } from "@/lib/ai-gateway/map-gateway-v1-models-response";

/** Server cache aligned with upstream refetch — one hour. */
export const revalidate = 3600;

/**
 * Proxies the Vercel AI Gateway `GET /v1/models` catalogue with Next.js caching,
 * returning models shaped for {@link import("@/lib/ai-gateway/types").GatewayModel | GatewayModel}.
 */
export async function GET() {
  const headers: HeadersInit = { Accept: "application/json" };
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch AI Gateway model list", upstreamStatus: res.status },
      { status: 502 },
    );
  }

  const body: unknown = await res.json();
  const models = gatewayV1ModelsResponseToGatewayModels({ body });

  return NextResponse.json({ models });
}
