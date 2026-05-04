"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Bot, Send, X, Loader2, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
  width: number
  onWidthChange: (width: number) => void
}

const PROMPTS = [
  "Build a data sync workflow",
  "Add error handling to my nodes",
  "Explain cron expression syntax",
]

export function AiSidebar({ isOpen, onClose, width, onWidthChange }: AiSidebarProps) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })
  const [input, setInput] = React.useState("")
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const isResizing = React.useRef(false)
  const startX = React.useRef(0)
  const startWidth = React.useRef(0)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const isLoading = status === "streaming" || status === "submitted"

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function startResize(e: React.MouseEvent) {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = "ew-resize"
    document.body.style.userSelect = "none"
  }

  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return
      const delta = startX.current - e.clientX
      onWidthChange(Math.min(800, Math.max(280, startWidth.current + delta)))
    }
    function onMouseUp() {
      isResizing.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [onWidthChange])

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  if (!isOpen) return null

  const currentWidth = isExpanded ? 560 : width

  return (
    <div
      className="relative flex flex-col border-l bg-background shrink-0 h-full"
      style={{ width: currentWidth }}
    >
      {/* Drag-to-resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 hover:bg-foreground/10 transition-colors"
      />

      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 h-11 shrink-0">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/8">
          <Bot className="size-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium flex-1">Assistant</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center gap-3 pt-8 pb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted">
                <Bot className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Runneroo AI</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] mx-auto leading-relaxed">
                  Ask me to help build, debug, or optimise your workflows
                </p>
              </div>
              <div className="w-full space-y-1.5 mt-1">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="w-full text-xs text-left rounded-lg ring-1 ring-foreground/10 px-3 py-2 hover:bg-accent hover:ring-foreground/20 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" && (
                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-muted shrink-0 mt-0.5">
                  <Bot className="size-3 text-muted-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl px-3 py-2 text-sm max-w-[88%] leading-relaxed",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {message.parts?.map((part, i) =>
                  part.type === "text" ? <span key={i}>{part.text}</span> : null
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-muted shrink-0 mt-0.5">
                <Bot className="size-3 text-muted-foreground" />
              </div>
              <div className="rounded-xl px-3 py-2 bg-muted">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 shrink-0">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask anything…"
              rows={1}
              className="flex-1 resize-none rounded-lg ring-1 ring-border bg-background px-3 py-2 text-sm outline-none focus:ring-ring placeholder:text-muted-foreground/60 min-h-[36px] max-h-[120px] transition-shadow"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-9 w-9 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-1.5">
            ⏎ send · ⇧⏎ newline
          </p>
        </form>
      </div>
    </div>
  )
}
