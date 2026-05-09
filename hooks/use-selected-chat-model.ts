"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models";

const STORAGE_KEY = "dailify-selected-chat-model";

/**
 * Reads the persisted assistant chat model ID from {@link window.localStorage}, if available.
 *
 * @returns The stored gateway model id, or the app default when storage is unreadable.
 */
function readStoredModelId(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  const raw = window.localStorage.getItem(STORAGE_KEY)?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_MODEL_ID;
}

/**
 * Shared model picker state for the assistant composer: persists the user's choice under
 * `dailify-selected-chat-model` and keeps other tabs in sync via the `storage` event.
 */
export function useSelectedChatModel() {
  // SSR and the first client paint stay aligned with `DEFAULT_MODEL_ID`; hydrate from storage after mount.
  const [modelId, setModelIdState] = useState<string>(DEFAULT_MODEL_ID);

  useLayoutEffect(() => {
    // Initialise from browser storage once after paint so server-rendered markup matches hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external store (localStorage) sync after mount only
    setModelIdState(readStoredModelId());
  }, []);

  useEffect(() => {
    const onStorage = ({ key, newValue }: StorageEvent) => {
      if (key !== STORAGE_KEY) return;
      setModelIdState(newValue && newValue.trim() ? newValue.trim() : DEFAULT_MODEL_ID);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setModelId = useCallback(({ modelId: nextId }: { modelId: string }) => {
    setModelIdState(nextId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    }
  }, []);

  return { modelId, setModelId };
}
