"use client";

import { GripVerticalIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export const CONTEXT_PANEL_STORAGE_KEY = "runneroo-assistant-context-panel-width";
export const CONTEXT_PANEL_OPEN_STORAGE_KEY = "runneroo-assistant-context-panel-open";
export const CONTEXT_PANEL_DEFAULT_WIDTH_PX = 320;
const MIN_WIDTH_PX = 220;
const MAX_WIDTH_PX = 640;

export function clampContextPanelWidth({ value }: { value: number }): number {
  return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, Math.round(value)));
}

export function readStoredContextPanelWidth(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONTEXT_PANEL_STORAGE_KEY);
  if (raw == null) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  return clampContextPanelWidth({ value: parsed });
}

export function readStoredContextPanelOpen(): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONTEXT_PANEL_OPEN_STORAGE_KEY);
  if (raw == null) return null;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return null;
}

type ContextPanelResizeHandleProps = {
  widthPx: number;
  onWidthChange: ({ widthPx }: { widthPx: number }) => void;
};

export function ContextPanelResizeHandle({
  widthPx,
  onWidthChange,
}: ContextPanelResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(widthPx);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = widthPx;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startXRef.current - moveEvent.clientX;
        const nextWidth = clampContextPanelWidth({ value: startWidthRef.current + delta });
        onWidthChange({ widthPx: nextWidth });
        window.localStorage.setItem(CONTEXT_PANEL_STORAGE_KEY, String(nextWidth));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [widthPx, onWidthChange]
  );

  return (
    <div
      role="separator"
      aria-label="Resize context panel"
      aria-orientation="vertical"
      className={`hidden lg:flex h-full w-1.5 shrink-0 cursor-col-resize select-none items-center justify-center hover:bg-accent/60 transition-colors ${
        isDragging ? "bg-accent" : ""
      }`}
      onMouseDown={handleMouseDown}
    >
      <GripVerticalIcon className="size-3.5 text-muted-foreground/40" aria-hidden />
    </div>
  );
}
