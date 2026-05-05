"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAssistantContext } from "@/components/assistant/assistant-context";
import {
  CONTEXT_PANEL_DEFAULT_WIDTH_PX,
  CONTEXT_PANEL_OPEN_STORAGE_KEY,
  ContextPanelResizeHandle,
  readStoredContextPanelOpen,
  readStoredContextPanelWidth,
} from "@/components/assistant/context-panel-resize-handle";
import { ContextSidebar } from "@/components/assistant/context-sidebar";
import { RunnerChat } from "@/components/assistant/runner-chat";
import { PanelRightCloseIcon, PanelRightOpenIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/** Syncs the browser URL to the active conversation ID without triggering a page navigation. */
function useConversationUrlSync({ activeConversationId }: { activeConversationId: string | null }) {
  useEffect(() => {
    const path = activeConversationId ? `/app/chat/${activeConversationId}` : "/app/chat";
    window.history.replaceState(null, "", path);
  }, [activeConversationId]);
}

const LG_BREAKPOINT_PX = 1024;

function getIsDesktop(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= LG_BREAKPOINT_PX;
}

export function AssistantShell() {
  const {
    conversationKey,
    startNewConversation,
    activeConversationId,
    activeConversationTitle,
  } = useAssistantContext();

  // Keep the browser URL in sync with the active conversation without triggering a page reload
  useConversationUrlSync({ activeConversationId });

  const [contextPanelWidthPx, setContextPanelWidthPx] = useState(CONTEXT_PANEL_DEFAULT_WIDTH_PX);
  const [contextPanelOpen, setContextPanelOpenState] = useState(false);

  const setContextPanelOpen = useCallback(({ open }: { open: boolean }) => {
    setContextPanelOpenState(open);
    if (getIsDesktop()) {
      window.localStorage.setItem(CONTEXT_PANEL_OPEN_STORAGE_KEY, open ? "1" : "0");
    }
  }, []);

  useEffect(() => {
    if (!getIsDesktop()) return;
    const storedWidth = readStoredContextPanelWidth();
    const storedOpen = readStoredContextPanelOpen();
    const id = requestAnimationFrame(() => {
      if (storedWidth != null) setContextPanelWidthPx(storedWidth);
      setContextPanelOpenState(storedOpen ?? true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const desktopOpenRef = useRef<boolean>(true);

  useEffect(() => {
    let wasDesktop = getIsDesktop();

    function handleResize() {
      const isDesktop = getIsDesktop();
      if (isDesktop === wasDesktop) return;
      wasDesktop = isDesktop;

      if (!isDesktop) {
        desktopOpenRef.current = contextPanelOpen;
        setContextPanelOpenState(false);
      } else {
        const storedOpen = readStoredContextPanelOpen();
        setContextPanelOpenState(storedOpen ?? desktopOpenRef.current);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [contextPanelOpen]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden lg:flex-row">
      {/* Chat column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />

          {/* Conversation title — centred and truncated */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {activeConversationTitle && (
              <span className="truncate text-sm font-medium" title={activeConversationTitle}>
                {activeConversationTitle}
              </span>
            )}
          </div>

          {!contextPanelOpen && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setContextPanelOpen({ open: true })}
              aria-label="Show context panel"
            >
              <PanelRightOpenIcon />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={startNewConversation}
            aria-label="New conversation"
          >
            <PlusIcon />
          </Button>
          <ThemeToggle />
        </header>

        {/* Chat body */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <RunnerChat key={conversationKey} conversationId={conversationKey} />
        </div>
      </div>

      {/* Resize handle */}
      {contextPanelOpen && (
        <ContextPanelResizeHandle
          widthPx={contextPanelWidthPx}
          onWidthChange={({ widthPx }) => setContextPanelWidthPx(widthPx)}
        />
      )}

      {/* Context panel */}
      {contextPanelOpen && (
        <div
          className="flex h-full min-h-0 w-full flex-none shrink-0 flex-col border-t lg:min-h-0 lg:min-w-[220px] lg:max-w-[640px] lg:w-[var(--context-panel-w)] lg:border-t-0 lg:border-l"
          style={{ "--context-panel-w": `${contextPanelWidthPx}px` } as CSSProperties}
        >
          {/* Context header */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <span className="min-w-0 flex-1 truncate font-semibold text-sm">
              Context &amp; Memory
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setContextPanelOpen({ open: false })}
              aria-label="Hide context panel"
            >
              <PanelRightCloseIcon />
            </Button>
          </header>

          {/* Context body */}
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
            <ContextSidebar />
          </div>
        </div>
      )}
    </div>
  );
}
