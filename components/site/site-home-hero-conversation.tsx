"use client"

import * as React from "react"

import { Conversation, ConversationContent } from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { cn } from "@/lib/utils"

const HERO_CHAT_SCRIPT: readonly { role: "user" | "assistant"; text: string }[] = [
  {
    role: "user",
    text: "Before stand-up: clashes, approvals, anything I should not miss?",
  },
  {
    role: "assistant",
    text:
      "You are double-booked with Product at ten. Three approvals are waiting: two inside SLA, one six hours over. Finance left a short note on the headcount workflow.",
  },
  {
    role: "user",
    text: "Give me one Slack line I can paste.",
  },
  {
    role: "assistant",
    text: "10:00 clash w/ Product; 3 approvals (1 overdue); headcount note from Finance; replying first.",
  },
] as const

/**
 * Subscribes to `prefers-reduced-motion` for {@link useSyncExternalStore}.
 */
function subscribePrefersReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getPrefersReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getPrefersReducedMotionServerSnapshot() {
  return false
}

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotionSnapshot,
    getPrefersReducedMotionServerSnapshot,
  )
}

/** Delays the hero demo between beats (typing, pauses, loop reset). */
function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * iMessage-style tail for the principal (user) bubble on the right.
 */
function UserBubbleTail({ className }: { className?: string }) {
  return (
    <svg
      width={18}
      height={14}
      viewBox="0 0 18 14"
      className={cn("absolute -bottom-px right-2 z-10 translate-x-1/2", className)}
      aria-hidden
    >
      <path d="M0.866025 8.80383L11.2583 0.803833C11.2583 0.803833 12.0621 9.5 17.2583 13.1961C12.0621 13.1961 0.866025 8.80383 0.866025 8.80383Z" />
    </svg>
  )
}

/**
 * Enter animation wrapper: fade and lift when a bubble appears.
 */
function BubbleEnter({
  children,
  show,
  reduceMotion,
  className,
}: {
  children: React.ReactNode
  show: boolean
  reduceMotion: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        reduceMotion
          ? show
            ? "opacity-100"
            : "opacity-0"
          : "will-change-[opacity,transform] transition-[opacity,transform] duration-500 ease-out",
        !reduceMotion && (show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"),
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Eases each new bubble in on first mount (hero demo only; remount when the parent `key` changes).
 */
function RevealOnMount({
  children,
  reduceMotion,
  className,
}: {
  children: React.ReactNode
  reduceMotion: boolean
  className?: string
}) {
  const [visible, setVisible] = React.useState(reduceMotion)

  React.useEffect(() => {
    if (reduceMotion) return
    const id = window.setTimeout(() => setVisible(true), 40)
    return () => window.clearTimeout(id)
  }, [reduceMotion])

  return (
    <BubbleEnter show={visible} reduceMotion={reduceMotion} className={className}>
      {children}
    </BubbleEnter>
  )
}

/**
 * Animated mock thread for the marketing hero: uses {@link Conversation} / {@link Message} like the in-app assistant.
 */
export function SiteHomeHeroConversation({ className }: { className?: string }) {
  const reduceMotion = usePrefersReducedMotion()
  const [cycleKey, setCycleKey] = React.useState(0)
  const [committed, setCommitted] = React.useState<{ role: "user" | "assistant"; text: string }[]>([])
  const [streamSource, setStreamSource] = React.useState<string | null>(null)
  const [streamLen, setStreamLen] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      setCommitted([])
      setStreamSource(null)
      setStreamLen(0)
      await sleep(reduceMotion ? 200 : 700)
      if (cancelled) return

      for (let i = 0; i < HERO_CHAT_SCRIPT.length; i++) {
        const line = HERO_CHAT_SCRIPT[i]
        if (!line) break

        if (line.role === "user") {
          await sleep(40)
          if (cancelled) return
          setCommitted((prev) => [...prev, { role: "user", text: line.text }])
          await sleep(reduceMotion ? 200 : 520)
          if (cancelled) return
          continue
        }

        // Assistant: stream characters (or show whole line when reduced motion)
        setStreamSource(line.text)
        if (reduceMotion) {
          setStreamLen(line.text.length)
          await sleep(120)
        } else {
          for (let c = 0; c <= line.text.length; c++) {
            if (cancelled) return
            setStreamLen(c)
            await sleep(14)
          }
        }
        if (cancelled) return
        setStreamSource(null)
        setStreamLen(0)
        setCommitted((prev) => [...prev, { role: "assistant", text: line.text }])
        await sleep(reduceMotion ? 250 : 480)
        if (cancelled) return
      }

      await sleep(reduceMotion ? 1800 : 3200)
      if (cancelled) return
      setCycleKey((k) => k + 1)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [cycleKey, reduceMotion])

  const streamingBody = streamSource ? streamSource.slice(0, streamLen) : ""
  const streamComplete =
    streamSource !== null && streamLen >= streamSource.length

  return (
    <div
      className={cn(
        "flex h-[min(420px,52vh)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <span className="size-2 rounded-full bg-red-400/90" aria-hidden />
        <span className="size-2 rounded-full bg-amber-400/90" aria-hidden />
        <span className="size-2 rounded-full bg-emerald-400/90" aria-hidden />
        <span className="ml-2 text-xs font-medium text-muted-foreground">Executive assistant</span>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="flex flex-col gap-4 p-5" scrollClassName="overflow-y-auto">
        {committed.map((m, idx) => (
          <RevealOnMount
            key={`${cycleKey}-${idx}-${m.role}`}
            reduceMotion={reduceMotion}
            className={m.role === "user" ? "self-end" : "self-start"}
          >
            {m.role === "user" ? (
              <Message from="user" className="max-w-[min(100%,260px)]">
                <MessageContent
                  className={cn(
                    "relative max-w-[min(100%,260px)] rounded-2xl border-0 !bg-foreground !px-3 !py-2.5 text-[13px] leading-snug !text-background shadow-none",
                    "group-[.is-user]:rounded-2xl",
                  )}
                >
                  <p className="m-0">{m.text}</p>
                  <UserBubbleTail className="fill-foreground" />
                </MessageContent>
              </Message>
            ) : (
              <Message from="assistant" className="max-w-[min(100%,280px)]">
                <MessageContent
                  className={cn(
                    "rounded-2xl rounded-bl-sm border border-border/80 bg-muted/25 !px-3 !py-2.5 text-[13px] leading-snug text-foreground shadow-none",
                    "group-[.is-assistant]:border-border/80",
                  )}
                >
                  <p className="m-0 text-foreground">{m.text}</p>
                </MessageContent>
              </Message>
            )}
          </RevealOnMount>
        ))}

        {streamSource !== null ? (
          <RevealOnMount key={streamSource} reduceMotion={reduceMotion} className="self-start">
            <Message from="assistant" className="max-w-[min(100%,280px)]">
              <MessageContent
                className={cn(
                  "rounded-2xl rounded-bl-sm border border-border/80 bg-muted/25 !px-3 !py-2.5 text-[13px] leading-snug shadow-none",
                  "group-[.is-assistant]:border-border/80",
                )}
              >
                <p className="m-0 text-foreground">
                  {streamingBody}
                  {!reduceMotion && !streamComplete ? (
                    <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-primary align-middle" aria-hidden />
                  ) : null}
                </p>
              </MessageContent>
            </Message>
          </RevealOnMount>
        ) : null}
        </ConversationContent>
      </Conversation>
    </div>
  )
}
