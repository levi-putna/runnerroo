"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, CpuIcon, HeartIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useFavouriteModelIds } from "@/hooks/use-favourite-model-ids";
import { DEFAULT_MODEL_ID, GATEWAY_MODELS } from "@/lib/ai-gateway/models";
import type { GatewayModel, ModelType, ProviderBucket } from "@/lib/ai-gateway/types";
import { MODEL_TYPE_LABELS } from "@/lib/ai-gateway/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelSelectorProps = {
  /** Fully qualified Gateway ID of the currently selected model, e.g. "openai/gpt-5.4-mini". */
  selectedModelId: string;
  onModelChange: ({ modelId }: { modelId: string }) => void;
  /**
   * Which gateway model category this picker lists (text, image, video, or embed).
   * The user cannot change category inside this component — pass a different `modelType` per screen
   * or mount another selector when you need another modality.
   *
   * @default "text"
   */
  modelType?: ModelType;
  disabled?: boolean;
  /**
   * Classes merged onto the dropdown trigger button.
   * Use e.g. `"w-full max-w-none"` when the control should span the full width of its container.
   */
  triggerClassName?: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Renders three bar segments indicating a performance level tier. */
function SpeedSegments({
  caption,
  level,
  title,
}: {
  caption: string;
  title: string;
  level: number;
}) {
  return (
    <span className="inline-flex max-w-[9rem] items-center gap-1" title={title}>
      <span className="w-8 shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {caption}
      </span>
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 w-2.5 rounded-[1px] bg-muted",
              segment <= level && "bg-foreground/50"
            )}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Renders a cost tier suffix as plain dollar signs: "$" for moderate, "$$" for premium.
 * Renders nothing for standard-tier models.
 */
function CostTierSuffix({ tier }: { tier: GatewayModel["costDollarTier"] }) {
  if (tier === 0) return null;

  const label =
    tier === 1
      ? "Moderate cost — $14–$24.99/M output"
      : "Premium cost — $25/M+ output";
  const mark = tier === 1 ? "$" : "$$";

  return (
    <span
      className="shrink-0 font-normal tabular-nums text-muted-foreground"
      title={label}
      aria-label={label}
    >
      {" "}
      {mark}
    </span>
  );
}

/** A single selectable model row used in featured, provider, and search result lists. */
function ModelPickerRow({
  model,
  onPick,
  isFavourite,
  onToggleFavourite,
}: {
  model: GatewayModel;
  onPick: ({ model }: { model: GatewayModel }) => void;
  isFavourite: boolean;
  onToggleFavourite: ({ modelId }: { modelId: string }) => void;
}) {
  const latencyTitle =
    "Indicative time-to-first-token class (more bars = faster). Derived from catalogue metadata.";
  const throughputTitle =
    "Indicative sustained output rate (more bars = higher throughput). Derived from catalogue metadata.";
  const toggleLabel = `${isFavourite ? "Remove" : "Add"} favourite: ${model.shortName}`;

  return (
    <DropdownMenuItem
      className="flex cursor-pointer flex-row items-start gap-2 py-2 pr-2 text-left leading-snug"
      onClick={() => onPick({ model })}
    >
      {/* Model name, cost tier, and pricing details */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        {/* Title row with cost indicator suffix */}
        <div className="flex w-full min-w-0 items-baseline gap-1 text-sm font-medium leading-tight">
          <span className="truncate">{model.shortName}</span>
          <CostTierSuffix tier={model.costDollarTier} />
        </div>

        {/* Context window and token pricing */}
        {(model.contextLabel || model.inputPriceLabel || model.outputPriceLabel) && (
          <p className="tabular-nums text-[11px] leading-relaxed text-muted-foreground">
            {model.contextLabel && <span>{model.contextLabel} ctx</span>}
            {model.contextLabel && model.inputPriceLabel && " · "}
            {model.inputPriceLabel && <span>In {model.inputPriceLabel}</span>}
            {model.inputPriceLabel && model.outputPriceLabel && " · "}
            {model.outputPriceLabel && <span>Out {model.outputPriceLabel}</span>}
          </p>
        )}

        {/* Latency and throughput bars (text models only) */}
        {model.latencyLevel !== null && model.throughputLevel !== null && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <SpeedSegments caption="LAT" title={latencyTitle} level={model.latencyLevel} />
            <SpeedSegments caption="TPS" title={throughputTitle} level={model.throughputLevel} />
          </div>
        )}
      </div>

      {/* Favourite toggle — isolated from the model pick action */}
      <span
        aria-label={toggleLabel}
        aria-pressed={isFavourite}
        className={cn(
          "shrink-0 rounded-md p-1 outline-none transition-colors hover:bg-accent",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "[&_svg]:pointer-events-none"
        )}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleFavourite({ modelId: model.id });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavourite({ modelId: model.id });
          }
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <HeartIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            isFavourite
              ? "fill-red-500 stroke-red-500 text-red-500"
              : "text-muted-foreground"
          )}
        />
      </span>
    </DropdownMenuItem>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Puts Featured rows in {@link GatewayModel.featuredOrder} order, then by name. */
function compareFeaturedModels({ a, b }: { a: GatewayModel; b: GatewayModel }): number {
  const oa = a.featuredOrder ?? 10_000;
  const ob = b.featuredOrder ?? 10_000;
  if (oa !== ob) return oa - ob;
  return a.shortName.localeCompare(b.shortName);
}

function modelMatchesQuery({
  model,
  queryLower,
}: {
  model: GatewayModel;
  queryLower: string;
}): boolean {
  if (!queryLower.length) return true;
  return (
    model.id.toLowerCase().includes(queryLower) ||
    model.shortName.toLowerCase().includes(queryLower) ||
    model.providerLabel.toLowerCase().includes(queryLower)
  );
}

/** Builds an alphabetically-sorted array of provider buckets from a model list. */
function buildProviderBuckets(models: GatewayModel[]): ProviderBucket[] {
  const map = new Map<string, ProviderBucket>();

  for (const model of models) {
    const existing = map.get(model.providerKey);
    if (existing) {
      existing.models.push(model);
    } else {
      map.set(model.providerKey, {
        key: model.providerKey,
        label: model.providerLabel,
        models: [model],
      });
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Lower-case phrase for search placeholder and empty state copy ("embedding" for embed models). */
function modelTypeSearchPhrase(type: ModelType): string {
  if (type === "embed") return "embedding";
  return MODEL_TYPE_LABELS[type].toLowerCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Reusable model selector dropdown for the Vercel AI Gateway.
 *
 * The catalogue slice is fixed by the `modelType` prop; there is no in-menu
 * type switch, so callers control modality per screen (e.g. text-only chat vs image-only tools).
 *
 * Features:
 * - Search, favourites, featured and provider-grouped browse for the given `modelType`
 * - Token cost and performance metadata per model (where applicable)
 */
export function ModelSelector({
  selectedModelId,
  onModelChange,
  modelType = "text",
  disabled,
  triggerClassName,
}: ModelSelectorProps) {
  const { favouriteIds, toggleFavourite, isFavourite } = useFavouriteModelIds();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  /** Live catalogue from the gateway (hourly server cache); until loaded, the static list is used. */
  const [remoteCatalogue, setRemoteCatalogue] = useState<GatewayModel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai-gateway/models");
        if (!res.ok) return;
        const json: unknown = await res.json();
        if (typeof json !== "object" || json === null || !("models" in json)) return;
        const models = (json as { models: unknown }).models;
        if (!Array.isArray(models) || models.length === 0) return;
        if (!cancelled) setRemoteCatalogue(models as GatewayModel[]);
      } catch {
        // Static fallback remains in use.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogue = remoteCatalogue ?? GATEWAY_MODELS;

  const modelById = useMemo(() => new Map(catalogue.map((m) => [m.id, m])), [catalogue]);

  useEffect(() => {
    const m = modelById.get(selectedModelId);
    if (m && m.type === modelType) return;
    const featured = catalogue
      .filter((x) => x.featured && x.type === modelType)
      .sort((a, b) => compareFeaturedModels({ a, b }));
    const pool = catalogue.filter((x) => x.type === modelType);
    const nextId = featured[0]?.id ?? pool[0]?.id;
    if (nextId && nextId !== selectedModelId) {
      onModelChange({ modelId: nextId });
    }
  }, [selectedModelId, modelType, onModelChange, modelById, catalogue]);

  // ── Filtered model pool for the active type ──────────────────────────────
  const typeModels = useMemo(
    () => catalogue.filter((m) => m.type === modelType),
    [catalogue, modelType]
  );

  // ── Browse mode data ─────────────────────────────────────────────────────
  const featuredModels = useMemo(
    () =>
      catalogue
        .filter((m) => m.featured && m.type === modelType)
        .sort((a, b) => compareFeaturedModels({ a, b })),
    [catalogue, modelType]
  );

  const providerBuckets = useMemo(
    () => buildProviderBuckets(typeModels),
    [typeModels]
  );

  const favouriteModels = useMemo<GatewayModel[]>(() => {
    if (!favouriteIds.length) return [];
    return favouriteIds
      .map((id) => modelById.get(id))
      .filter((m): m is GatewayModel => m != null && m.type === modelType);
  }, [favouriteIds, modelType, modelById]);

  // ── Search mode data ─────────────────────────────────────────────────────
  const queryLower = searchQuery.trim().toLowerCase();
  const isSearchMode = queryLower.length > 0;

  const filteredModels = useMemo<GatewayModel[]>(() => {
    if (!queryLower.length) return [];
    return typeModels.filter((m) => modelMatchesQuery({ model: m, queryLower }));
  }, [typeModels, queryLower]);

  // ── Trigger label ────────────────────────────────────────────────────────
  const triggerLabel = useMemo(() => {
    const found = modelById.get(selectedModelId);
    return found?.shortName ?? selectedModelId ?? DEFAULT_MODEL_ID;
  }, [selectedModelId, modelById]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
    if (!open) {
      setSearchQuery("");
    } else {
      // Restore focus to search field after the menu animation.
      const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  const handlePick = useCallback(
    ({ model }: { model: GatewayModel }) => {
      if (model.type !== modelType) return;
      onModelChange({ modelId: model.id });
      setMenuOpen(false);
      setSearchQuery("");
    },
    [onModelChange, modelType]
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      {/* Trigger button — styled as a compact outline button */}
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "justify-between gap-2 font-normal",
              triggerClassName ?? "max-w-[min(100vw,18rem)]"
            )}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CpuIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[min(calc(100vw-3rem),22rem)] p-2"
      >
        {/* Search — list is fixed to `modelType` from props */}
        <div className="px-0.5 pb-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              ref={searchInputRef}
              type="search"
              aria-label={`Search ${modelType === "embed" ? "embedding" : MODEL_TYPE_LABELS[modelType]} models`}
              placeholder={`Search ${modelTypeSearchPhrase(modelType)} models`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "h-7 w-full rounded-lg border-0 bg-muted px-8 py-1 pr-7 text-sm",
                "text-foreground outline-none placeholder:text-muted-foreground/40",
                "ring-offset-background hover:bg-muted/80",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              onKeyDown={(event) => {
                if (event.key === "Escape") return;
                event.stopPropagation();
              }}
            />
          </div>
        </div>

        {/* Search results — flat list */}
        {isSearchMode ? (
          <div className="max-h-[min(62vh,20rem)] space-y-0.5 overflow-y-auto pr-0.5">
            {filteredModels.length > 0 ? (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {filteredModels.length} model{filteredModels.length !== 1 ? "s" : ""}
                </DropdownMenuLabel>
                {filteredModels.map((model) => (
                  <ModelPickerRow
                    key={model.id}
                    model={model}
                    isFavourite={isFavourite(model.id)}
                    onPick={handlePick}
                    onToggleFavourite={toggleFavourite}
                  />
                ))}
              </DropdownMenuGroup>
            ) : (
              // Empty search state
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <SearchIcon className="size-6 text-muted-foreground/40" aria-hidden />
                <p className="text-xs text-muted-foreground">
                  No results for &ldquo;{searchQuery.trim()}&rdquo;
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Favourites sub-menu (when any exist for this type) */}
            {favouriteModels.length > 0 && (
              <div className="space-y-0.5 pr-0.5">
                <DropdownMenuSub key="__favourites">
                  <DropdownMenuSubTrigger
                    className="gap-2 text-sm font-medium"
                    title="Models you have marked as favourites"
                  >
                    <span className="truncate">Favourites</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className={cn(
                      "w-[min(100vw-2rem,22rem)] p-2",
                      "max-h-[min(60vh,20rem)] overflow-y-auto"
                    )}
                    sideOffset={6}
                  >
                    {favouriteModels.map((model) => (
                      <ModelPickerRow
                        key={model.id}
                        model={model}
                        isFavourite={isFavourite(model.id)}
                        onPick={handlePick}
                        onToggleFavourite={toggleFavourite}
                      />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </div>
            )}

            {/* Separator between Favourites and Featured when Featured is absent */}
            {favouriteModels.length > 0 &&
              featuredModels.length === 0 &&
              providerBuckets.length > 0 && (
                <DropdownMenuSeparator className="my-2" />
              )}

            {/* Featured sub-menu */}
            {featuredModels.length > 0 && (
              <div className="space-y-0.5 pr-0.5">
                <DropdownMenuSub key="__featured">
                  <DropdownMenuSubTrigger
                    className="gap-2 text-sm font-medium"
                    title={`Curated ${modelTypeSearchPhrase(modelType)} model picks`}
                  >
                    <span className="truncate">Featured</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className={cn(
                      "w-[min(100vw-2rem,22rem)] p-2",
                      "max-h-[min(60vh,20rem)] overflow-y-auto"
                    )}
                    sideOffset={6}
                  >
                    {featuredModels.map((model) => (
                      <ModelPickerRow
                        key={model.id}
                        model={model}
                        isFavourite={isFavourite(model.id)}
                        onPick={handlePick}
                        onToggleFavourite={toggleFavourite}
                      />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </div>
            )}

            {/* Separator between Featured and provider buckets */}
            {featuredModels.length > 0 && providerBuckets.length > 0 && (
              <DropdownMenuSeparator className="my-2" />
            )}

            {/* Per-provider sub-menus */}
            {providerBuckets.length > 0 ? (
              <div className="max-h-[min(52vh,18rem)] space-y-0.5 overflow-y-auto pr-0.5">
                {providerBuckets.map((bucket) => (
                  <DropdownMenuSub key={bucket.key}>
                    <DropdownMenuSubTrigger className="gap-2 text-sm font-medium">
                      <span className="truncate">{bucket.label}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      className={cn(
                        "w-[min(100vw-2rem,22rem)] p-2",
                        "max-h-[min(60vh,20rem)] overflow-y-auto"
                      )}
                      sideOffset={6}
                    >
                      {bucket.models.map((model) => (
                        <ModelPickerRow
                          key={model.id}
                          model={model}
                          isFavourite={isFavourite(model.id)}
                          onPick={handlePick}
                          onToggleFavourite={toggleFavourite}
                        />
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </div>
            ) : (
              // Empty state when no models exist for this type
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <CpuIcon className="size-6 text-muted-foreground/40" aria-hidden />
                <p className="text-xs text-muted-foreground">
                  No {modelTypeSearchPhrase(modelType)} models available yet.
                </p>
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
