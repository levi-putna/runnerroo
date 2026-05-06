import { GatewayUsagePanel } from "@/components/settings/gateway-usage-panel";

/**
 * AI Gateway usage for the signed-in user (assistant conversations, workflow runs, memory embeddings).
 * Summary cards (below filters), filters at the top of the body, the usage table, and pagination live in {@link GatewayUsagePanel}, which renders {@link PageHeader} and
 * the padded body — same top alignment as profile, integrations, and memories (no outer page padding).
 */
export default function SettingsUsagePage() {
  return <GatewayUsagePanel className="w-full" />;
}
