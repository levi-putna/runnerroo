"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import {
  DEFAULT_MODEL_ID,
  findModelById,
  getFeaturedModels,
  GATEWAY_MODELS,
  getModelsByType,
} from "@/lib/ai-gateway/models";
import type { GatewayModel, ModelType, ProviderBucket } from "@/lib/ai-gateway/types";
import { MODEL_TYPE_LABELS } from "@/lib/ai-gateway/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelSelectorProps = {
  /** Fully qualified Gateway ID of the currently selected model, e.g. "openai/gpt-5.4-mini". */
  selectedModelId: string;
  onModelChange: ({ modelId }: { modelId: string }) => void;
  /** Initial model type tab shown when the dropdown first opens. Defaults to "text". */
  defaultModelType?: ModelType;
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

/** Case-insensitive match on model ID, short name, or provider label. */
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

// ─── Model type tab order for the filter strip ────────────────────────────────
const MODEL_TYPE_TABS: ModelType[] = ["text", "image", "video", "embed"];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Reusable model selector dropdown for the Vercel AI Gateway.
 *
 * Features:
 * - Filters models by type (text / image / video / embed)
 * - Search across the filtered model list
 * - Favourites (persisted to localStorage)
 * - Featured and provider-grouped browse mode
 * - Token cost and performance metadata per model
 */
export function ModelSelector({
  selectedModelId,
  onModelChange,
  defaultModelType = "text",
  disabled,
  triggerClassName,
}: ModelSelectorProps) {
  const { favouriteIds, toggleFavourite, isFavourite } = useFavouriteModelIds();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState<ModelType>(defaultModelType);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Filtered model pool for the active type ──────────────────────────────
  const typeModels = useMemo(() => getModelsByType(activeType), [activeType]);

  // ── Browse mode data ─────────────────────────────────────────────────────
  const featuredModels = useMemo(
    () => getFeaturedModels(activeType),
    [activeType]
  );

  const providerBuckets = useMemo(
    () => buildProviderBuckets(typeModels),
    [typeModels]
  );

  const favouriteModels = useMemo<GatewayModel[]>(() => {
    if (!favouriteIds.length) return [];
    const byId = new Map(GATEWAY_MODELS.map((m) => [m.id, m]));
    return favouriteIds
      .map((id) => byId.get(id))
      .filter((m): m is GatewayModel => m != null && m.type === activeType);
  }, [favouriteIds, activeType]);

  // ── Search mode data ─────────────────────────────────────────────────────
  const queryLower = searchQuery.trim().toLowerCase();
  const isSearchMode = queryLower.length > 0;

  const filteredModels = useMemo<GatewayModel[]>(() => {
    if (!queryLower.length) return [];
    return typeModels.filter((m) => modelMatchesQuery({ model: m, queryLower }));
  }, [typeModels, queryLower]);

  // ── Trigger label ────────────────────────────────────────────────────────
  const triggerLabel = useMemo(() => {
    const found = findModelById(selectedModelId);
    return found?.shortName ?? selectedModelId ?? DEFAULT_MODEL_ID;
  }, [selectedModelId]);

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
      onModelChange({ modelId: model.id });
      setMenuOpen(false);
      setSearchQuery("");
    },
    [onModelChange]
  );

  const handleTypeChange = useCallback((type: ModelType) => {
    setActiveType(type);
    setSearchQuery("");
    // Re-focus search after the state update settles.
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

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
        {/* Model type filter strip */}
        <div className="mb-2 flex gap-1 px-0.5">
          {MODEL_TYPE_TABS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                activeType === type
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {MODEL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="px-0.5 pb-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              ref={searchInputRef}
              type="search"
              aria-label={`Search ${MODEL_TYPE_LABELS[activeType]} models`}
              placeholder={`Search ${MODEL_TYPE_LABELS[activeType].toLowerCase()} models`}
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
                    title={`Curated ${MODEL_TYPE_LABELS[activeType].toLowerCase()} model picks`}
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
                  No {MODEL_TYPE_LABELS[activeType].toLowerCase()} models available yet.
                </p>
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
