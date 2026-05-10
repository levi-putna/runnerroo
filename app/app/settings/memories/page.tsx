import { MemoriesSettingsPanel } from "@/components/settings/memories-settings-panel";

/**
 * Long-term assistant memories: type dropdown (defaults to all), search, and permanent delete — same shell pattern as the
 * Gateway usage settings page (`GatewayUsagePanel` + `PageHeader` + padded body).
 */
export default function MemoriesSettingsPage() {
  return <MemoriesSettingsPanel className="w-full" />;
}
