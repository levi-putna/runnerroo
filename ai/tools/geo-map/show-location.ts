import { tool } from "ai";
import { z } from "zod";
import type { SerializableGeoMap } from "@/components/tool-ui/geo-map";

/**
 * Geocodes one or more addresses/locations and returns a GeoMap payload
 * that is rendered directly by the GeoMap tool UI component.
 *
 * Uses the free Nominatim (OpenStreetMap) geocoding API — no API key required.
 */
export const showLocation = tool({
  description:
    "Show one or more addresses, locations, or points of interest on an interactive map. Accepts a list of location names or street addresses and renders them as map markers. Use this whenever the user asks to see where something is located on a map.",
  inputSchema: z.object({
    locations: z
      .array(
        z.object({
          label: z.string().min(1).describe("A short human-readable label for the marker (e.g. 'Head Office')."),
          address: z.string().min(1).describe("The full address or location name to geocode (e.g. '1 Martin Place, Sydney NSW 2000')."),
          description: z.string().optional().describe("Optional additional detail shown in the map popup."),
        })
      )
      .min(1)
      .describe("One or more locations to show on the map."),
    title: z.string().optional().describe("An optional title displayed above the map."),
  }),
  execute: async ({ locations, title }) => {
    // Geocode each location sequentially using Nominatim.
    // Nominatim requests should be spaced ≥1 s apart per policy — we await
    // each fetch before starting the next.
    const markers: Array<{
      id: string;
      lat: number;
      lng: number;
      label: string;
      description?: string;
      tooltip: "hover";
      icon: { type: "dot"; color: string };
    }> = [];

    for (const loc of locations) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", loc.address);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");

      const res = await fetch(url.toString(), {
        headers: {
          // Nominatim requires a User-Agent identifying the application.
          "User-Agent": "Runnerroo/1.0 (+https://www.openstreetmap.org/copyright)",
        },
      });

      if (!res.ok) {
        throw new Error(`Geocoding failed for "${loc.address}": ${res.statusText}`);
      }

      const results = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;

      if (!results.length) {
        throw new Error(`Could not find a location matching "${loc.address}". Please try a more specific address.`);
      }

      const result = results[0];

      markers.push({
        id: `marker-${markers.length + 1}`,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        label: loc.label,
        description: loc.description ?? result.display_name,
        tooltip: "hover",
        icon: { type: "dot", color: "#6366f1" },
      });

      // Brief pause between requests to respect Nominatim rate limits.
      if (locations.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    const payload: SerializableGeoMap = {
      id: `geo-map-${Date.now()}`,
      title,
      markers,
      viewport: { mode: "fit", target: "markers", padding: 60, maxZoom: 15 },
      clustering: { enabled: true },
    };

    return payload;
  },
});
