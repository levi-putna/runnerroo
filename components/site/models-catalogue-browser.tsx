"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, SearchIcon } from "lucide-react"

import { ModelsCatalogueTable } from "@/components/site/models-catalogue-table"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { gatewayModelMatchesSearchQuery } from "@/lib/ai-gateway/gateway-model-search"
import type { GatewayModel } from "@/lib/ai-gateway/types"
import { cn } from "@/lib/utils"

const ALL_PROVIDERS_VALUE = "all"

/** Compact filter surface — aligned with the runs hub toolbar in `WorkflowRunHubClient`. */
const MODELS_FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/**
 * Label on the provider filter trigger (matches Command item labels).
 */
function providerTriggerLabel({
  providerKey,
  providerOptions,
}: {
  providerKey: string
  providerOptions: { key: string; label: string }[]
}): string {
  if (providerKey === ALL_PROVIDERS_VALUE) return "All providers"
  return providerOptions.find((p) => p.key === providerKey)?.label ?? "All providers"
}

/**
 * Client-side search and provider filter for the public models catalogue (runs hub–style toolbar).
 */
export function ModelsCatalogueBrowser({
  models,
  className,
}: {
  models: GatewayModel[]
  className?: string
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [providerKey, setProviderKey] = useState<string>(ALL_PROVIDERS_VALUE)
  const [providerPickerOpen, setProviderPickerOpen] = useState(false)

  /** Distinct providers for the picker, sorted by display label. */
  const providerOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const model of models) {
      if (!map.has(model.providerKey)) {
        map.set(model.providerKey, model.providerLabel)
      }
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [models])

  const providerOptionCount = 1 + providerOptions.length
  const providerScopeBadge =
    providerKey === ALL_PROVIDERS_VALUE
      ? `${providerOptionCount}/${providerOptionCount}`
      : `1/${providerOptionCount}`

  const queryLower = searchQuery.trim().toLowerCase()

  /** Models matching text search and optional provider filter. */
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      if (providerKey !== ALL_PROVIDERS_VALUE && model.providerKey !== providerKey) {
        return false
      }
      return gatewayModelMatchesSearchQuery({ model, queryLower })
    })
  }, [models, providerKey, queryLower])

  if (models.length === 0) {
    return <ModelsCatalogueTable models={[]} />
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter toolbar — same pill pattern as run hub; equal-width columns on large screens */}
      <div className="grid w-full min-w-0 gap-2 sm:gap-3 lg:grid-cols-2">
        {/* Search (border wraps input, like Runs name search) */}
        <div
          className={cn(
            MODELS_FILTER_TRIGGER_CLASS,
            "min-h-9 w-full min-w-0 justify-start gap-2 py-0 pl-2 pr-2",
          )}
        >
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, id, or provider…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search models by name, id, or provider"
            aria-describedby="models-catalogue-count"
            className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Provider — popover + command list like Runs trigger / status filters */}
        <Popover open={providerPickerOpen} onOpenChange={setProviderPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(MODELS_FILTER_TRIGGER_CLASS, "min-h-9 w-full min-w-0 justify-between gap-2")}
            >
              <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                <span className="size-1.5 rounded-full bg-violet-500" />
                <span className="size-1.5 rounded-full bg-sky-500" />
                <span className="size-1.5 rounded-full bg-amber-500" />
              </span>
              <span className="shrink-0 text-muted-foreground">Provider</span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {providerScopeBadge}
              </span>
              <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
                {providerTriggerLabel({ providerKey, providerOptions })}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(100vw-2rem,22rem)] p-0">
            <Command>
              <CommandInput placeholder="Search providers…" />
              <CommandList>
                <CommandEmpty>No provider found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value={ALL_PROVIDERS_VALUE}
                    keywords={["all", "providers", "every"]}
                    onSelect={() => {
                      setProviderKey(ALL_PROVIDERS_VALUE)
                      setProviderPickerOpen(false)
                    }}
                  >
                    All providers
                  </CommandItem>
                  {providerOptions.map(({ key, label }) => (
                    <CommandItem
                      key={key}
                      value={key}
                      keywords={[label, key]}
                      onSelect={() => {
                        setProviderKey(key)
                        setProviderPickerOpen(false)
                      }}
                    >
                      {label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Result count */}
      <p id="models-catalogue-count" className="text-sm text-muted-foreground">
        Showing {filteredModels.length} of {models.length} models
        {queryLower.length > 0 || providerKey !== ALL_PROVIDERS_VALUE ? " (filtered)" : null}
      </p>

      {/* Table or empty filter state */}
      {filteredModels.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          No models match your search or provider filter. Try clearing the search box or choosing &quot;All providers&quot;
          from the provider menu.
        </p>
      ) : (
        <ModelsCatalogueTable models={filteredModels} />
      )}
    </div>
  )
}
