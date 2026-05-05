"use client";

import { useCallback, useState } from "react";
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models";

const STORAGE_KEY = "runneroo-selected-chat-model";

function readStoredModelId(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL_ID;
}

export function useSelectedChatModel() {
  const [modelId, setModelIdState] = useState<string>(() => readStoredModelId());

  const setModelId = useCallback(({ modelId: nextId }: { modelId: string }) => {
    setModelIdState(nextId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    }
  }, []);

  return { modelId, setModelId };
}
