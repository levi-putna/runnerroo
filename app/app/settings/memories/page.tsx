"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrainIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MemoryRow = {
  id: string;
  key: string;
  content: string;
  type: string;
  status: string;
  updated_at: string;
  created_at: string;
};

export default function MemoriesSettingsPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMemories = useCallback(async ({ search }: { search: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (search.trim()) params.set("q", search.trim());

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
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadMemories({ search: query });
    }, 250);
    return () => window.clearTimeout(id);
  }, [loadMemories, query]);

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
    <div className="flex flex-col gap-6 p-6">
      <div className="max-w-3xl">
        <h1 className="text-lg font-semibold">Memories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage long-term assistant memories. Sorted by most recently updated.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by key, content, or type"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BrainIcon className="size-4" />
          {rows.length} total · {activeCount} active
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Key</div>
          <div className="col-span-5">Content</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">Loading memories…</div>
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
              <div className="col-span-3 pr-2 font-mono text-xs text-muted-foreground">
                {memory.key}
              </div>
              <div className="col-span-5 pr-3">
                <p className="line-clamp-3 whitespace-pre-wrap">{memory.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {new Date(memory.updated_at).toLocaleString()}
                </p>
              </div>
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
  );
}
