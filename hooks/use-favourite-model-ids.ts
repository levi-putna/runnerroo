"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "runneroo.favourite-model-ids";

/**
 * Reads the stored favourite model IDs from localStorage.
 * Returns an empty array if the value is missing or malformed.
 */
function readStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persists the given favourite model IDs array to localStorage.
 */
function writeStoredIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Silently ignore storage errors (e.g. private browsing quota exceeded).
  }
}

/**
 * Manages the user's favourite model IDs, persisted in localStorage.
 *
 * Returns the current list of favourite IDs, a toggle function, and an
 * `isFavourite` helper — mirroring the same API used by the reference selector.
 */
export function useFavouriteModelIds() {
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    setFavouriteIds(readStoredIds());
  }, []);

  const toggleFavourite = useCallback(({ modelId }: { modelId: string }) => {
    setFavouriteIds((prev) => {
      const next = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];
      writeStoredIds(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (modelId: string): boolean => favouriteIds.includes(modelId),
    [favouriteIds]
  );

  return { favouriteIds, toggleFavourite, isFavourite };
}
