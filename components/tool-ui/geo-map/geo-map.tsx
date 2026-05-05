"use client";

import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SerializableGeoMap } from "@/components/tool-ui/geo-map/schema";

export type GeoMapProps = SerializableGeoMap & {
  className?: string;
};

/**
 * Lightweight map summary: marker list plus an OpenStreetMap embed for the bounding box.
 */
export function GeoMap({ title, markers, className }: GeoMapProps) {
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const pad = 0.01;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card p-3", className)}>
      {title ? <h4 className="text-sm font-semibold">{title}</h4> : null}

      {/* Embedded map (OpenStreetMap export widget) */}
      <div className="relative w-full overflow-hidden rounded-md border" style={{ height: 280 }}>
        <iframe title="OpenStreetMap preview" className="h-full w-full border-0" src={embedSrc} />
      </div>

      {/* Marker list for accessibility and copy-friendly labels */}
      <ul className="space-y-2 text-xs">
        {markers.map((m) => (
          <li key={m.id} className="flex gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <div className="font-medium">{m.label}</div>
              {m.description ? <div className="text-muted-foreground">{m.description}</div> : null}
              <a
                className="text-primary hover:underline"
                href={`https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=15/${m.lat}/${m.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open at {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
