import { GatewayUsagePanel } from "@/components/settings/gateway-usage-panel";

/**
 * AI Gateway usage for the signed-in user (assistant conversations, workflow runs, memory embeddings).
 * Filters and the usage table are implemented in {@link GatewayUsagePanel}, which also renders the page header so layout matches other settings screens.
 */
export default function SettingsUsagePage() {
  return (
    <div className="mx-auto flex w-full max-w-none flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
      <GatewayUsagePanel className="w-full max-w-none" />
    </div>
  );
}
