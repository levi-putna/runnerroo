/** User-selected mode for an integration tool (Settings + policy). */
export type McpToolPermissionMode = "disabled" | "auto" | "approval";

/**
 * Lightweight summary passed into assistant instructions when integrations are enabled.
 */
export type McpIntegrationsBrief = {
  /** Short bullet list suitable for system prompt appendix. */
  summaryLines: string[];
};
