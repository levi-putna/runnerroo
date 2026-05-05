"use client";

import { MapPin, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GeoMap, safeParseSerializableGeoMap } from "@/components/tool-ui/geo-map";
import type {
  DynamicToolUIPart,
  ChatAddToolApproveResponseFunction,
  ChatAddToolOutputFunction,
  UIMessage,
} from "ai";

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

/**
 * Skeleton placeholder shaped like the GeoMap (w-full, h-[320px] with rounded border).
 * Includes subtle grid lines and a centred pin icon to suggest a map is loading.
 */
function MapSkeleton() {
  return (
    <div className="w-full min-w-0 rounded-lg border bg-muted/20 overflow-hidden relative" style={{ height: 320 }}>
      {/* Faint grid lines mimicking map tiles */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="rounded-none opacity-30 h-full w-full" />
        ))}
      </div>

      {/* Centre pin + label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
        <MapPin size={28} strokeWidth={1.5} />
        <div className="space-y-1.5 flex flex-col items-center">
          <Skeleton className="h-2.5 w-24 rounded" />
          <Skeleton className="h-2.5 w-16 rounded opacity-60" />
        </div>
      </div>
    </div>
  );
}

/**
 * Tool UI for the `showLocation` tool.
 *
 * Renders a shape-matched map skeleton while the model streams tool input or
 * waits for the server response, then renders the GeoMap component.
 */
export function ShowLocationUI({ part }: Props) {
  // ── input-streaming / input-available / approval-responded ─────────────

  if (
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "approval-responded"
  ) {
    return <MapSkeleton />;
  }

  // ── output-available ───────────────────────────────────────────────────

  if (part.state === "output-available") {
    const parsed = safeParseSerializableGeoMap(part.output);

    if (!parsed) {
      return (
        <div className="w-full min-w-0 rounded-lg border border-destructive/20 bg-destructive/5 flex flex-col items-center justify-center gap-3 text-destructive" style={{ height: 320 }}>
          <AlertTriangle size={24} className="opacity-70" />
          <p className="text-sm font-medium">Map data could not be parsed.</p>
        </div>
      );
    }

    return <GeoMap {...parsed} className="w-full" />;
  }

  // ── output-error ───────────────────────────────────────────────────────

  if (part.state === "output-error") {
    return (
      <div className="w-full min-w-0 rounded-lg border border-destructive/20 bg-destructive/5 flex flex-col items-center justify-center gap-3 text-destructive" style={{ height: 320 }}>
        <AlertTriangle size={24} className="opacity-70" />
        <p className="text-sm font-medium">{part.errorText ?? "Could not load the map."}</p>
      </div>
    );
  }

  return null;
}
