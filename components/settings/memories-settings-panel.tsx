"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrainIcon, ChevronDownIcon, SearchIcon, TagIcon, Trash2Icon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { MEMORY_TYPES, type MemoryType } from "@/lib/memories/types";
import { cn } from "@/lib/utils";

type MemoryRow = {
  id: string;
  key: string;
  content: string;
  type: string;
  status: string;
  updated_at: string;
  created_at: string;
};

type MemoryTypeFilter = "all" | MemoryType;

const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const TABLE_SKELETON_ROWS = 6;

/**
 * Presents a memory `type` value in title case for filter labels (e.g. `technical_context`).
 */
function formatMemoryTypeLabel({ type }: { type: MemoryType }): string {
  return type
    .split("_")
    .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

/**
 * Settings body for browsing and deleting assistant memories (layout aligned with Gateway usage).
 */
export function MemoriesSettingsPanel({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MemoryTypeFilter>("all");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const typeTriggerLabel = typeFilter === "all" ? "All types" : formatMemoryTypeLabel({ type: typeFilter });

  const loadMemories = useCallback(
    async ({ search, type }: { search: string; type: MemoryTypeFilter }) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (search.trim()) params.set("q", search.trim());
        if (type !== "all") params.set("type", type);

        const response = await fetch(`/api/memories?${params.toString()}`);
        if (!response.ok) throw new Error("Unable to load memories.");

        const payload = (await response.json()) as { memories?: MemoryRow[] };
        const sorted = [...(payload.memories ?? [])].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setRows(sorted);
      } catch {
        setError("Could not load memories right now. Please try again.");
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadMemories({ search: query, type: typeFilter });
    }, 250);
    return () => window.clearTimeout(id);
  }, [loadMemories, query, typeFilter]);

  const activeCount = useMemo(
    () => rows.filter((m) => m.status === "active").length,
    [rows]
  );

  const handleDelete = useCallback(async ({ id }: { id: string }) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed.");
      setRows((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div className={cn("flex flex-col", className)}>
      <PageHeader
        title="Memories"
        description="Review and manage long-term assistant memories. Deleting a row removes it permanently from retrieval."
      />

      <div className="flex flex-col gap-4 p-6">
        {/* Filters — type dropdown + search (usage-style pills, no outer filter card) */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <Popover open={typePickerOpen} onOpenChange={setTypePickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={cn(FILTER_TRIGGER_CLASS, "max-w-[min(100%,20rem)]")}>
                <TagIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 text-muted-foreground">Type</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{typeTriggerLabel}</span>
                <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[16rem] p-0">
              <Command>
                <CommandInput placeholder="Search types…" />
                <CommandList>
                  <CommandEmpty>No type found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      keywords={["all", "types", "any"]}
                      onSelect={() => {
                        setTypeFilter("all");
                        setTypePickerOpen(false);
                      }}
                    >
                      All types
                    </CommandItem>
                    {MEMORY_TYPES.map((memoryType) => (
                      <CommandItem
                        key={memoryType}
                        value={memoryType}
                        keywords={[memoryType, formatMemoryTypeLabel({ type: memoryType })]}
                        onSelect={() => {
                          setTypeFilter(memoryType);
                          setTypePickerOpen(false);
                        }}
                      >
                        {formatMemoryTypeLabel({ type: memoryType })}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by key, content, or type"
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BrainIcon className="size-4 shrink-0" aria-hidden />
          <span>
            {rows.length} shown · {activeCount} active in results
          </span>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Key</div>
            <div className="col-span-4">Content</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-0 px-4 py-3">
              {Array.from({ length: TABLE_SKELETON_ROWS }).map((_, index) => (
                <div key={`mem-skel-${index}`} className="grid grid-cols-12 items-center gap-2 border-t py-3 first:border-t-0">
                  <Skeleton className="col-span-2 h-4" />
                  <Skeleton className="col-span-3 h-4" />
                  <Skeleton className="col-span-4 h-4" />
                  <Skeleton className="col-span-1 h-4" />
                  <Skeleton className="col-span-2 h-8 justify-self-end" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">No memories found.</div>
          ) : (
            rows.map((memory) => (
              <div
                key={memory.id}
                className="grid grid-cols-12 items-start border-t px-4 py-3 text-sm first:border-t-0"
              >
                <div className="col-span-2">
                  <span className="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">
                    {memory.type}
                  </span>
                </div>
                <div className="col-span-3 pr-2 font-mono text-xs text-muted-foreground">{memory.key}</div>
                <div className="col-span-4 pr-3">
                  <p className="line-clamp-3 whitespace-pre-wrap">{memory.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(memory.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="col-span-1 text-xs capitalize text-muted-foreground">{memory.status}</div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete({ id: memory.id })}
                    disabled={deletingId === memory.id}
                    className="gap-1.5"
                  >
                    <Trash2Icon className="size-4" />
                    {deletingId === memory.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
