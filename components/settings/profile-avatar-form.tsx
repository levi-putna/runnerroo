"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AVATAAARS_NEUTRAL_EYEBROWS,
  AVATAAARS_NEUTRAL_EYES,
  AVATAAARS_NEUTRAL_MOUTHS,
  BOTTTTS_NEUTRAL_EYES,
  BOTTTTS_NEUTRAL_MOUTHS,
  buildDicebearAvatarUrl,
  FUN_EMOJI_EYES,
  FUN_EMOJI_MOUTHS,
  getResolvedAvatarUrl,
  parseDicebearAvatarFromMetadata,
  type DicebearAvatarStored,
  type DicebearStyle,
} from "@/lib/avatar/dicebear"
import { createClient } from "@/lib/supabase/client"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { SettingsSectionPanel } from "@/components/settings/settings-section-panel"
import { Checkbox } from "@/components/ui/checkbox"
import { ColorPicker } from "@/components/ui/color-picker"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Loader2, ImageIcon } from "lucide-react"

const AUTO_VALUE = "__auto__"

/**
 * Normalises a hex string for the shadcn colour picker (expects `#` plus six hex digits).
 */
function toHexForPicker({
  hex,
  fallback,
}: {
  hex: string
  fallback: `#${string}`
}): `#${string}` {
  const n = hex.replace(/^#/, "").toLowerCase()
  if (/^[a-f0-9]{6}$/.test(n)) return `#${n}` as `#${string}`
  return fallback
}

type ProfileAvatarFormProps = {
  email: string
  userMetadata: Record<string, unknown>
}

/**
 * Syncs form fields from Supabase `user_metadata` (email is always used as the DiceBear seed; it is not shown in the UI).
 */
function formStateFromMetadata({
  userMetadata,
}: {
  userMetadata: Record<string, unknown>
}): {
  style: DicebearStyle
  eyes: string
  mouth: string
  eyebrows: string
  textColor: string
  backgroundColor: string
  backgroundType: "gradientLinear" | "solid"
  flip: boolean
  rotate: number
} {
  const stored = parseDicebearAvatarFromMetadata({ userMetadata })
  if (stored?.custom === true && stored.style) {
    return {
      style: stored.style,
      eyes: stored.eyes ?? AUTO_VALUE,
      mouth: stored.mouth ?? AUTO_VALUE,
      eyebrows: stored.eyebrows ?? AUTO_VALUE,
      textColor: stored.textColor
        ? `#${String(stored.textColor).replace(/^#/, "")}`
        : "#ffffff",
      backgroundColor: stored.backgroundColor
        ? `#${String(stored.backgroundColor).replace(/^#/, "")}`
        : "#b6e3f4",
      backgroundType: stored.backgroundType ?? "gradientLinear",
      flip: stored.flip ?? false,
      rotate: typeof stored.rotate === "number" ? stored.rotate : 0,
    }
  }
  return {
    style: "bottts-neutral",
    eyes: AUTO_VALUE,
    mouth: AUTO_VALUE,
    eyebrows: AUTO_VALUE,
    textColor: "#ffffff",
    backgroundColor: "#b6e3f4",
    backgroundType: "gradientLinear",
    flip: false,
    rotate: 0,
  }
}

/**
 * Settings card: default avatar from the user email, optional full customisation behind a switch. Persists to `user_metadata.dicebear_avatar`.
 */
export function ProfileAvatarForm({ email, userMetadata }: ProfileAvatarFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  const stored = parseDicebearAvatarFromMetadata({ userMetadata })
  const serverCustomActive = stored?.custom === true

  const avatarMetaSig = useMemo(
    () => JSON.stringify(userMetadata.dicebear_avatar ?? null),
    [userMetadata.dicebear_avatar]
  )

  const seedForDicebear = (email.trim() || "user")

  const [customiseEnabled, setCustomiseEnabled] = useState(serverCustomActive)
  const [style, setStyle] = useState<DicebearStyle>(() => formStateFromMetadata({ userMetadata }).style)
  const [eyes, setEyes] = useState(() => formStateFromMetadata({ userMetadata }).eyes)
  const [mouth, setMouth] = useState(() => formStateFromMetadata({ userMetadata }).mouth)
  const [eyebrows, setEyebrows] = useState(() => formStateFromMetadata({ userMetadata }).eyebrows)
  const [textColor, setTextColor] = useState(() => formStateFromMetadata({ userMetadata }).textColor)
  const [backgroundColor, setBackgroundColor] = useState(
    () => formStateFromMetadata({ userMetadata }).backgroundColor
  )
  const [backgroundType, setBackgroundType] = useState(
    () => formStateFromMetadata({ userMetadata }).backgroundType
  )
  const [flip, setFlip] = useState(() => formStateFromMetadata({ userMetadata }).flip)
  const [rotate, setRotate] = useState(() => formStateFromMetadata({ userMetadata }).rotate)

  const prevSigRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevSigRef.current === avatarMetaSig) return
    prevSigRef.current = avatarMetaSig
    const next = formStateFromMetadata({ userMetadata })
    setStyle(next.style)
    setEyes(next.eyes)
    setMouth(next.mouth)
    setEyebrows(next.eyebrows)
    setTextColor(next.textColor)
    setBackgroundColor(next.backgroundColor)
    setBackgroundType(next.backgroundType)
    setFlip(next.flip)
    setRotate(next.rotate)
    setCustomiseEnabled(parseDicebearAvatarFromMetadata({ userMetadata })?.custom === true)
  }, [avatarMetaSig, email, userMetadata])

  const eyesOptions =
    style === "bottts-neutral"
      ? BOTTTTS_NEUTRAL_EYES
      : style === "fun-emoji"
        ? FUN_EMOJI_EYES
        : style === "avataaars-neutral"
          ? AVATAAARS_NEUTRAL_EYES
          : ([] as readonly string[])

  const mouthOptions =
    style === "bottts-neutral"
      ? BOTTTTS_NEUTRAL_MOUTHS
      : style === "fun-emoji"
        ? FUN_EMOJI_MOUTHS
        : style === "avataaars-neutral"
          ? AVATAAARS_NEUTRAL_MOUTHS
          : ([] as readonly string[])

  const showFaceEyesMouth = style !== "initials"
  const showAvataaarsEyebrows = style === "avataaars-neutral"
  const showInitialsTextColour = style === "initials"

  const defaultAvatarUrl = useMemo(
    () => getResolvedAvatarUrl({ email, userMetadata }),
    [email, userMetadata]
  )

  const customPreviewUrl = useMemo(
    () =>
      buildDicebearAvatarUrl({
        style,
        seed: seedForDicebear,
        eyes: showFaceEyesMouth && eyes !== AUTO_VALUE ? eyes : undefined,
        mouth: showFaceEyesMouth && mouth !== AUTO_VALUE ? mouth : undefined,
        eyebrows:
          showAvataaarsEyebrows && eyebrows !== AUTO_VALUE ? eyebrows : undefined,
        backgroundColor: backgroundColor.replace("#", ""),
        backgroundType,
        textColor: showInitialsTextColour ? textColor.replace("#", "") : undefined,
        flip: flip || undefined,
        rotate: rotate !== 0 ? rotate : undefined,
      }),
    [
      style,
      seedForDicebear,
      eyes,
      mouth,
      eyebrows,
      backgroundColor,
      backgroundType,
      textColor,
      flip,
      rotate,
      showFaceEyesMouth,
      showAvataaarsEyebrows,
      showInitialsTextColour,
    ]
  )

  const displayAvatarUrl = customiseEnabled ? customPreviewUrl : defaultAvatarUrl

  const initials =
    email.split("@")[0]?.slice(0, 2).toUpperCase() || "?"

  function buildPayload(): DicebearAvatarStored {
    const bgHex = backgroundColor.replace(/^#/, "").toLowerCase()
    const letterHex = textColor.replace(/^#/, "").toLowerCase()
    return {
      custom: true,
      style,
      seed: seedForDicebear,
      ...(style !== "initials" && eyes !== AUTO_VALUE ? { eyes } : {}),
      ...(style !== "initials" && mouth !== AUTO_VALUE ? { mouth } : {}),
      ...(style === "avataaars-neutral" && eyebrows !== AUTO_VALUE ? { eyebrows } : {}),
      ...(/^[a-f0-9]{6}$/.test(bgHex) ? { backgroundColor: bgHex } : {}),
      backgroundType,
      ...(style === "initials" && /^[a-f0-9]{6}$/.test(letterHex) ? { textColor: letterHex } : {}),
      ...(flip ? { flip: true } : {}),
      ...(rotate !== 0 ? { rotate } : {}),
    }
  }

  async function handleSave() {
    setMessage(null)
    const payload = buildPayload()
    const { error } = await supabase.auth.updateUser({
      data: { dicebear_avatar: payload },
    })
    if (error) {
      setMessage({ tone: "error", text: error.message })
      return
    }
    setMessage({ tone: "success", text: "Avatar saved to your profile." })
    startTransition(() => router.refresh())
  }

  async function handleCustomiseSwitch({ checked }: { checked: boolean }) {
    setMessage(null)
    if (checked) {
      setCustomiseEnabled(true)
      return
    }
    setCustomiseEnabled(false)
    const { error } = await supabase.auth.updateUser({
      data: { dicebear_avatar: { custom: false } as DicebearAvatarStored },
    })
    if (error) {
      setMessage({ tone: "error", text: error.message })
      setCustomiseEnabled(true)
      return
    }
    setMessage({
      tone: "success",
      text: "Using the default avatar for your email.",
    })
    startTransition(() => router.refresh())
  }

  return (
    <SettingsSectionPanel
      id="avatar"
      dataTestId="profile-avatar-section"
      icon={ImageIcon}
      title="Avatar"
      subtitle="Here is an avatar we created just for you. If you would prefer, build your own."
      footerHint={
        customiseEnabled
          ? "Save to store this look on your account. Until then, preview changes are local only."
          : "We generate a default from your email. Turn on customisation to design your own, then save."
      }
      footerActions={
        customiseEnabled ? (
          <Button type="button" onClick={() => void handleSave()} disabled={pending} data-testid="profile-avatar-save">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save avatar
          </Button>
        ) : null
      }
    >
      {/* Avatar preview and customise switch */}
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <div data-testid="profile-avatar-preview">
          <UserAvatar
            src={displayAvatarUrl}
            alt="Avatar preview"
            fallback={initials}
            className="h-24 w-24"
            fallbackClassName="text-lg"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Label htmlFor="avatar-customise" className="font-normal whitespace-nowrap">
            Customise avatar
          </Label>
          <Switch
            id="avatar-customise"
            data-testid="profile-avatar-customise-switch"
            checked={customiseEnabled}
            disabled={pending}
            onCheckedChange={(c) => void handleCustomiseSwitch({ checked: c })}
          />
        </div>
      </div>

      {customiseEnabled ? (
        <>
          <p className="text-sm text-muted-foreground">
            Adjust your choices below, then save to keep this avatar on your account.
          </p>
          {/* Style */}
          <div className="space-y-1.5">
            <Label htmlFor="avatar-style">Style</Label>
            <Select
              value={style}
              onValueChange={(v) => {
                const next = v as DicebearStyle
                setStyle(next)
                setEyes(AUTO_VALUE)
                setMouth(AUTO_VALUE)
                setEyebrows(AUTO_VALUE)
              }}
            >
              <SelectTrigger id="avatar-style" data-testid="profile-avatar-style" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottts-neutral">Bottts neutral</SelectItem>
                <SelectItem value="fun-emoji">Fun emoji</SelectItem>
                <SelectItem value="avataaars-neutral">Avataaars neutral</SelectItem>
                <SelectItem value="initials">Initials</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Character features (not for initials style) */}
          {showFaceEyesMouth ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {showAvataaarsEyebrows ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="avatar-eyebrows">Eyebrows</Label>
                  <Select value={eyebrows} onValueChange={(v) => setEyebrows(v ?? AUTO_VALUE)}>
                    <SelectTrigger id="avatar-eyebrows" className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO_VALUE}>Automatic</SelectItem>
                      {AVATAAARS_NEUTRAL_EYEBROWS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="avatar-eyes">Eyes</Label>
                <Select value={eyes} onValueChange={(v) => setEyes(v ?? AUTO_VALUE)}>
                  <SelectTrigger id="avatar-eyes" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_VALUE}>Automatic</SelectItem>
                    {eyesOptions.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avatar-mouth">Mouth</Label>
                <Select value={mouth} onValueChange={(v) => setMouth(v ?? AUTO_VALUE)}>
                  <SelectTrigger id="avatar-mouth" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_VALUE}>Automatic</SelectItem>
                    {mouthOptions.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {showInitialsTextColour ? (
            <div className="space-y-1.5">
              <Label htmlFor="avatar-text-colour-trigger">Letter colour</Label>
              <ColorPicker
                value={toHexForPicker({ hex: textColor, fallback: "#ffffff" })}
                onValueChange={({ hex }) => setTextColor(hex.toLowerCase())}
                hideContrastRatio
              >
                <Button
                  type="button"
                  id="avatar-text-colour-trigger"
                  variant="outline"
                  className="h-9 w-full max-w-xs justify-start gap-2 font-mono text-xs sm:w-auto"
                >
                  {/* Swatch */}
                  <span
                    className="size-4 shrink-0 rounded border border-border"
                    style={{ backgroundColor: textColor }}
                    aria-hidden
                  />
                  {textColor}
                </Button>
              </ColorPicker>
              <p className="text-xs text-muted-foreground">
                Colour for the initials. See the{" "}
                <a
                  className="underline underline-offset-2"
                  href="https://www.dicebear.com/styles/initials/"
                  rel="noreferrer"
                  target="_blank"
                >
                  DiceBear initials
                </a>{" "}
                style.
              </p>
            </div>
          ) : null}

          {/* Background and transform */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="avatar-bg-type">Background</Label>
              <Select
                value={backgroundType}
                onValueChange={(v) => setBackgroundType(v as "gradientLinear" | "solid")}
              >
                <SelectTrigger id="avatar-bg-type" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gradientLinear">Gradient</SelectItem>
                  <SelectItem value="solid">Solid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatar-bg-colour-trigger">Background colour</Label>
              <ColorPicker
                value={toHexForPicker({ hex: backgroundColor, fallback: "#b6e3f4" })}
                onValueChange={({ hex }) => setBackgroundColor(hex.toLowerCase())}
                hideContrastRatio
              >
                <Button
                  type="button"
                  id="avatar-bg-colour-trigger"
                  variant="outline"
                  className="h-9 w-full min-w-0 justify-start gap-2 font-mono text-xs"
                >
                  {/* Swatch */}
                  <span
                    className="size-4 shrink-0 rounded border border-border"
                    style={{ backgroundColor: backgroundColor }}
                    aria-hidden
                  />
                  {backgroundColor}
                </Button>
              </ColorPicker>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatar-rotate">Rotation</Label>
              <Select value={String(rotate)} onValueChange={(v) => setRotate(Number(v))}>
                <SelectTrigger id="avatar-rotate" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0°</SelectItem>
                  <SelectItem value="90">90°</SelectItem>
                  <SelectItem value="180">180°</SelectItem>
                  <SelectItem value="270">270°</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="avatar-flip"
                checked={flip}
                onCheckedChange={(c) => setFlip(c === true)}
              />
              <Label htmlFor="avatar-flip" className="font-normal">
                Flip horizontally
              </Label>
            </div>
          </div>
        </>
      ) : null}

      {message ? (
        <p
          className={
            message.tone === "success" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-destructive"
          }
          role="status"
          data-testid="profile-avatar-message"
        >
          {message.text}
        </p>
      ) : null}
    </SettingsSectionPanel>
  )
}
