"use client"

import { useState, useTransition } from "react"
import { Bot, MessageSquare, VolumeX, Lightbulb, AlignLeft, HelpCircle } from "lucide-react"
import { Loader2 } from "lucide-react"

import { SettingsSectionPanel } from "@/components/settings/settings-section-panel"
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
import { PageHeader } from "@/components/page-header"
import {
  ASSISTANT_ROLES,
  ASSISTANT_ROLE_DESCRIPTIONS,
  ASSISTANT_ROLE_LABELS,
  CLARIFICATION_BEHAVIOURS,
  CLARIFICATION_BEHAVIOUR_DESCRIPTIONS,
  CLARIFICATION_BEHAVIOUR_LABELS,
  RECOMMENDATION_STYLES,
  RECOMMENDATION_STYLE_DESCRIPTIONS,
  RECOMMENDATION_STYLE_LABELS,
  type AssistantRole,
  type AssistantSettings,
  type ClarificationBehaviour,
  type RecommendationStyle,
} from "@/lib/assistant-settings/types"

const FREE_TEXT_MAX = 250

type AssistantSettingsPanelProps = {
  initialSettings: AssistantSettings
  className?: string
}

type SaveMessage = { tone: "success" | "error"; text: string }

/** Shows remaining character count for a free-text field, turning red when near the limit. */
function CharCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length
  return (
    <p className={`text-xs tabular-nums ${remaining <= 20 ? "text-destructive" : "text-muted-foreground"}`}>
      {remaining} / {max}
    </p>
  )
}

/**
 * Full-page assistant settings panel.
 * Renders six setting sections matching the settings-section-panel shell used elsewhere.
 */
export function AssistantSettingsPanel({ initialSettings, className }: AssistantSettingsPanelProps) {
  // --- local state mirrors the saved row ---
  const [role, setRole] = useState<AssistantRole>(initialSettings.role)
  const [voiceAndTone, setVoiceAndTone] = useState(initialSettings.voice_and_tone)
  const [thingsToNeverSay, setThingsToNeverSay] = useState(initialSettings.things_to_never_say)
  const [recommendationStyle, setRecommendationStyle] = useState<RecommendationStyle>(
    initialSettings.recommendation_style
  )
  const [defaultOutputFormat, setDefaultOutputFormat] = useState(initialSettings.default_output_format)
  const [clarificationBehaviour, setClarificationBehaviour] = useState<ClarificationBehaviour>(
    initialSettings.clarification_behaviour
  )

  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null)
  const [pending, startTransition] = useTransition()

  /** Persists all settings in a single PATCH call. */
  async function handleSave() {
    setSaveMessage(null)

    const response = await fetch("/api/assistant-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        voice_and_tone: voiceAndTone,
        things_to_never_say: thingsToNeverSay,
        recommendation_style: recommendationStyle,
        default_output_format: defaultOutputFormat,
        clarification_behaviour: clarificationBehaviour,
      }),
    })

    if (!response.ok) {
      const json = (await response.json()) as { error?: string }
      setSaveMessage({ tone: "error", text: json.error ?? "Failed to save settings." })
      return
    }

    setSaveMessage({ tone: "success", text: "Assistant settings saved." })
  }

  /** Shared save button used in every panel footer. */
  const saveButton = (
    <Button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void handleSave())}
    >
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
      Save changes
    </Button>
  )

  return (
    <div className={className}>
      {/* Page header */}
      <PageHeader
        title="Assistant"
        description="Customise how the assistant behaves, communicates, and responds."
      />

      <div className="p-6 max-w-2xl mx-auto w-full space-y-6">

        {/* Global save feedback */}
        {saveMessage ? (
          <p
            className={
              saveMessage.tone === "success"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-sm text-destructive"
            }
            role="status"
          >
            {saveMessage.text}
          </p>
        ) : null}

        {/* Role */}
        <SettingsSectionPanel
          icon={Bot}
          title="Role"
          subtitle="The primary function of the assistant. Shapes how it prioritises tasks, what context it draws on, and how it frames responses."
          footerActions={saveButton}
        >
          <div className="space-y-2">
            <Select value={role} onValueChange={(v) => setRole(v as AssistantRole)}>
              <SelectTrigger>
                {/* Explicitly show the human-readable label in the trigger */}
                <SelectValue>{ASSISTANT_ROLE_LABELS[role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ASSISTANT_ROLES.map((r) => (
                  <SelectItem
                    key={r}
                    value={r}
                    description={ASSISTANT_ROLE_DESCRIPTIONS[r]}
                  >
                    {ASSISTANT_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SettingsSectionPanel>

        {/* Voice & tone */}
        <SettingsSectionPanel
          icon={MessageSquare}
          title="Voice &amp; tone"
          subtitle="Describe how you want the assistant to write and speak. Add real examples where helpful."
          footerHint="Changes apply from the next message onwards."
          footerActions={saveButton}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="assistant-voice-tone">Description</Label>
              <CharCount value={voiceAndTone} max={FREE_TEXT_MAX} />
            </div>
            <Textarea
              id="assistant-voice-tone"
              rows={4}
              maxLength={FREE_TEXT_MAX}
              value={voiceAndTone}
              onChange={(e) => setVoiceAndTone(e.target.value)}
              placeholder="e.g. Direct and confident. Skip pleasantries. Write like a trusted colleague, not a customer service agent."
            />
          </div>
        </SettingsSectionPanel>

        {/* Things to never say */}
        <SettingsSectionPanel
          icon={VolumeX}
          title="Things to never say"
          subtitle="Specific words, phrases, or structural habits to filter out automatically."
          footerHint='Separate entries with commas or new lines. e.g. "Certainly!", "leverage", avoid em dashes.'
          footerActions={saveButton}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="assistant-never-say">Blocklist</Label>
              <CharCount value={thingsToNeverSay} max={FREE_TEXT_MAX} />
            </div>
            <Textarea
              id="assistant-never-say"
              rows={4}
              maxLength={FREE_TEXT_MAX}
              value={thingsToNeverSay}
              onChange={(e) => setThingsToNeverSay(e.target.value)}
              placeholder={`e.g. Avoid filler affirmations ("Certainly!", "Great question!"). Avoid cliched business phrases. Never use an em dash.`}
            />
          </div>
        </SettingsSectionPanel>

        {/* Recommendation style */}
        <SettingsSectionPanel
          icon={Lightbulb}
          title="Recommendation style"
          subtitle="Whether you want options laid out so you can decide, or a direct recommendation with reasoning."
          footerActions={saveButton}
        >
          <Select
            value={recommendationStyle}
            onValueChange={(v) => setRecommendationStyle(v as RecommendationStyle)}
          >
            <SelectTrigger>
              <SelectValue>{RECOMMENDATION_STYLE_LABELS[recommendationStyle]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RECOMMENDATION_STYLES.map((s) => (
                <SelectItem
                  key={s}
                  value={s}
                  description={RECOMMENDATION_STYLE_DESCRIPTIONS[s]}
                >
                  {RECOMMENDATION_STYLE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsSectionPanel>

        {/* Default output format — free text */}
        <SettingsSectionPanel
          icon={AlignLeft}
          title="Default output format"
          subtitle="Describe your preference for how responses are structured."
          footerHint="e.g. Bullet points for everything. Or: prose for narrative, bullets for steps. Lead with the answer."
          footerActions={saveButton}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="assistant-output-format">Format preference</Label>
              <CharCount value={defaultOutputFormat} max={FREE_TEXT_MAX} />
            </div>
            <Textarea
              id="assistant-output-format"
              rows={3}
              maxLength={FREE_TEXT_MAX}
              value={defaultOutputFormat}
              onChange={(e) => setDefaultOutputFormat(e.target.value)}
              placeholder="e.g. Prose for narrative tasks, bullet points for action items. Always lead with the most important thing."
            />
          </div>
        </SettingsSectionPanel>

        {/* Clarification behaviour */}
        <SettingsSectionPanel
          icon={HelpCircle}
          title="Clarification behaviour"
          subtitle="Whether the assistant should ask questions before starting a task, or make reasonable assumptions and proceed."
          footerActions={saveButton}
        >
          <Select
            value={clarificationBehaviour}
            onValueChange={(v) => setClarificationBehaviour(v as ClarificationBehaviour)}
          >
            <SelectTrigger>
              <SelectValue>{CLARIFICATION_BEHAVIOUR_LABELS[clarificationBehaviour]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CLARIFICATION_BEHAVIOURS.map((b) => (
                <SelectItem
                  key={b}
                  value={b}
                  description={CLARIFICATION_BEHAVIOUR_DESCRIPTIONS[b]}
                >
                  {CLARIFICATION_BEHAVIOUR_LABELS[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsSectionPanel>

      </div>
    </div>
  )
}
