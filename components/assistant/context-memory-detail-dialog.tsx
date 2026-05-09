"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2Icon } from "lucide-react";

type MemoryApiRow = {
  id: string;
  user_id?: string;
  key: string;
  content: string;
  type: string;
  status: string;
  importance?: number;
  confidence?: number;
  created_at?: string;
  updated_at?: string;
};

type ContextMemoryDetailDialogProps = {
  memoryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: ({ memoryId }: { memoryId: string }) => void;
};

export function ContextMemoryDetailDialog({
  memoryId,
  open,
  onOpenChange,
  onDeleted,
}: ContextMemoryDetailDialogProps) {
  const [detail, setDetail] = useState<MemoryApiRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open || !memoryId) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void fetch(`/api/memories/${memoryId}`, { method: "GET" })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))
      )
      .then((row: MemoryApiRow) => {
        if (!cancelled) setDetail(row);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load that memory.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [memoryId, open]);

  const handleDelete = useCallback(async () => {
    if (!memoryId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/memories/${memoryId}?reason=context_sidebar_delete`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onDeleted({ memoryId });
      onOpenChange(false);
    } catch {
      setLoadError("Delete failed — please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [memoryId, onDeleted, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-6rem)] sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Saved memory</DialogTitle>
          <DialogDescription>
            Review the memory Dailify surfaced in this sidebar preview.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div aria-busy aria-label="Loading memory" className="flex flex-col gap-4 py-1">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-4 w-full max-w-[90%]" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : detail ? (
          <ScrollArea className="max-h-[320px] pr-4">
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="font-medium uppercase tracking-wide text-muted-foreground">Key</dt>
                <dd className="mt-1 break-all text-sm text-foreground">{detail.key}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-muted-foreground">Type · Status</dt>
                <dd className="mt-1 text-sm capitalize text-foreground">
                  {detail.type} · {detail.status}
                </dd>
              </div>
              {detail.updated_at ? (
                <div>
                  <dt className="font-medium uppercase tracking-wide text-muted-foreground">Updated</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {new Date(detail.updated_at).toLocaleString()}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="font-medium uppercase tracking-wide text-muted-foreground">Content</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
                  {detail.content}
                </dd>
              </div>
            </dl>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing to show.</p>
        )}

        <DialogFooter className="sm:justify-between sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!memoryId || isLoading || isDeleting || !detail}
            onClick={() => void handleDelete()}
            className="gap-2"
          >
            <Trash2Icon className="size-4 shrink-0" aria-hidden />
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
