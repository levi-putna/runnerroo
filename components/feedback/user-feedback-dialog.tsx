"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type FeedbackMood = "great" | "okay" | "rough"

const FEEDBACK_TOPICS = [
  { value: "bug", label: "Bug or problem" },
  { value: "feature", label: "Feature request" },
  { value: "ux", label: "Usability or design" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Something else" },
] as const

type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]["value"]

const MOOD_OPTIONS: {
  id: FeedbackMood
  label: string
  /** Large emoji as a simple illustration (no extra image assets). */
  emoji: string
  gradientClass: string
}[] = [
  {
    id: "great",
    label: "Love it",
    emoji: "😄",
    gradientClass:
      "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/50 dark:to-orange-950/40",
  },
  {
    id: "okay",
    label: "It is okay",
    emoji: "😐",
    gradientClass:
      "bg-gradient-to-br from-slate-100 to-zinc-200 dark:from-slate-800/80 dark:to-zinc-800/80",
  },
  {
    id: "rough",
    label: "Needs work",
    emoji: "😕",
    gradientClass:
      "bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-950/45 dark:to-indigo-950/45",
  },
]

type UserFeedbackDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal for collecting product feedback: mood, topic, and free-text notes.
 * Submits locally only (no API yet); extend `handleSubmit` when a backend exists.
 */
export function UserFeedbackDialog({ open, onOpenChange }: UserFeedbackDialogProps) {
  const [mood, setMood] = useState<FeedbackMood | null>(null)
  const [topic, setTopic] = useState<FeedbackTopic>("bug")
  const [message, setMessage] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function resetForm() {
    setMood(null)
    setTopic("bug")
    setMessage("")
    setSubmitted(false)
  }

  function handleSubmit() {
    if (!mood || message.trim().length < 3) return
    console.info("[feedback]", { mood, topic, message: message.trim() })
    setSubmitted(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="gap-4 sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Feedback</DialogTitle>
          <DialogDescription>
            Tell us how things are going. Your note helps us prioritise what to improve next.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <p className="text-sm text-muted-foreground" role="status">
            Thanks — we have recorded your feedback.
          </p>
        ) : (
          <>
            {/* Mood — three illustration-style emoji tiles */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">How are you feeling about the product?</Label>
              <div className="grid grid-cols-3 gap-2">
                {MOOD_OPTIONS.map((opt) => {
                  const selected = mood === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMood(opt.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-[box-shadow,transform,border-color]",
                        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        selected
                          ? "border-primary shadow-sm"
                          : "border-transparent ring-1 ring-border/80 hover:ring-border"
                      )}
                      aria-pressed={selected}
                      aria-label={opt.label}
                    >
                      <span
                        className={cn(
                          "flex size-14 items-center justify-center rounded-full text-3xl leading-none",
                          opt.gradientClass
                        )}
                      >
                        {opt.emoji}
                      </span>
                      <span className="text-xs font-medium text-foreground">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <Label htmlFor="feedback-topic">Topic</Label>
              <Select value={topic} onValueChange={(v) => setTopic(v as FeedbackTopic)}>
                <SelectTrigger id="feedback-topic" className="w-full" size="default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TOPICS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label htmlFor="feedback-message">Your feedback</Label>
              <Textarea
                id="feedback-message"
                placeholder="What would you like us to know?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-y"
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground">At least 3 characters.</p>
            </div>
          </>
        )}

        <DialogFooter className="border-0 bg-transparent p-0 sm:flex-row sm:justify-end">
          {submitted ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!mood || message.trim().length < 3}
                onClick={handleSubmit}
              >
                Send feedback
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { FEEDBACK_TOPICS }
