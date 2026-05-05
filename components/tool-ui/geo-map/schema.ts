import { z } from "zod";

const markerSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  description: z.string().optional(),
  tooltip: z.enum(["hover"]).optional(),
  icon: z
    .object({
      type: z.literal("dot"),
      color: z.string(),
    })
    .optional(),
});

const serializableGeoMapSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  markers: z.array(markerSchema).min(1),
  viewport: z
    .object({
      mode: z.enum(["fit"]),
      target: z.enum(["markers"]),
      padding: z.number().optional(),
      maxZoom: z.number().optional(),
    })
    .optional(),
  clustering: z
    .object({
      enabled: z.boolean(),
    })
    .optional(),
});

export type SerializableGeoMap = z.infer<typeof serializableGeoMapSchema>;

/**
 * Validates tool output before the map UI renders it.
 */
export function safeParseSerializableGeoMap(data: unknown): SerializableGeoMap | null {
  const parsed = serializableGeoMapSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
