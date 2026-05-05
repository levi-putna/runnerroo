import type { User } from "@supabase/supabase-js"

/** Supported DiceBear HTTP API styles for this app. */
export type DicebearStyle =
  | "bottts-neutral"
  | "fun-emoji"
  | "avataaars-neutral"
  | "initials"

const DICEBEAR_STYLE_IDS: readonly DicebearStyle[] = [
  "bottts-neutral",
  "fun-emoji",
  "avataaars-neutral",
  "initials",
] as const

function isDicebearStyle(value: unknown): value is DicebearStyle {
  return typeof value === "string" && (DICEBEAR_STYLE_IDS as readonly string[]).includes(value)
}

const DICEBEAR_API_VERSION_BASE = "https://api.dicebear.com/9.x"

/** Eye options for the bottts-neutral style (DiceBear 9.x). */
export const BOTTTTS_NEUTRAL_EYES = [
  "bulging",
  "dizzy",
  "eva",
  "frame1",
  "frame2",
  "glow",
  "happy",
  "hearts",
  "robocop",
  "round",
  "roundFrame01",
  "roundFrame02",
  "sensor",
  "shade01",
] as const

/** Mouth options for the bottts-neutral style (DiceBear 9.x). */
export const BOTTTTS_NEUTRAL_MOUTHS = [
  "bite",
  "diagram",
  "grill01",
  "grill02",
  "grill03",
  "smile01",
  "smile02",
  "square01",
  "square02",
] as const

/** Eye options for the fun-emoji style (DiceBear 9.x). */
export const FUN_EMOJI_EYES = [
  "closed",
  "closed2",
  "crying",
  "cute",
  "glasses",
  "love",
  "pissed",
  "plain",
  "sad",
  "shades",
  "sleepClose",
  "stars",
  "tearDrop",
  "wink",
  "wink2",
] as const

/** Mouth options for the fun-emoji style (DiceBear 9.x). */
export const FUN_EMOJI_MOUTHS = [
  "cute",
  "drip",
  "faceMask",
  "kissHeart",
  "lilSmile",
  "pissed",
  "plain",
  "sad",
  "shout",
  "shy",
  "sick",
  "smileLol",
  "smileTeeth",
  "tongueOut",
  "wideSmile",
] as const

/** Eyebrow options for the avataaars-neutral style ([DiceBear](https://www.dicebear.com/styles/avataaars-neutral/)). */
export const AVATAAARS_NEUTRAL_EYEBROWS = [
  "angry",
  "angryNatural",
  "default",
  "defaultNatural",
  "flatNatural",
  "frownNatural",
  "raisedExcited",
  "raisedExcitedNatural",
  "sadConcerned",
  "sadConcernedNatural",
  "unibrowNatural",
  "upDown",
  "upDownNatural",
] as const

/** Eye options for the avataaars-neutral style. */
export const AVATAAARS_NEUTRAL_EYES = [
  "closed",
  "cry",
  "default",
  "eyeRoll",
  "happy",
  "hearts",
  "side",
  "squint",
  "surprised",
  "wink",
  "winkWacky",
  "xDizzy",
] as const

/** Mouth options for the avataaars-neutral style. */
export const AVATAAARS_NEUTRAL_MOUTHS = [
  "concerned",
  "default",
  "disbelief",
  "eating",
  "grimace",
  "sad",
  "screamOpen",
  "serious",
  "smile",
  "tongue",
  "twinkle",
  "vomit",
] as const

/**
 * Shape of `user_metadata.dicebear_avatar` after the user saves a custom avatar.
 * When `custom` is false, automatic resolution (email-seeded default avatar) applies.
 */
export type DicebearAvatarStored = {
  custom: boolean
  style?: DicebearStyle
  /** Seed string forwarded to DiceBear; defaults to the user email when saving. */
  seed?: string
  eyes?: string
  mouth?: string
  /** Avataaars neutral only. */
  eyebrows?: string
  /** Lowercase hex without a leading `#`, e.g. `b6e3f4`. */
  backgroundColor?: string
  backgroundType?: "gradientLinear" | "solid"
  /** Initials style only ([DiceBear](https://www.dicebear.com/styles/initials/)). */
  textColor?: string
  flip?: boolean
  rotate?: number
}

type BuildDicebearUrlParams = {
  style: DicebearStyle
  seed: string
  eyes?: string
  mouth?: string
  eyebrows?: string
  backgroundColor?: string
  backgroundType?: "gradientLinear" | "solid"
  textColor?: string
  flip?: boolean
  rotate?: number
  size?: number
}

/**
 * Builds a DiceBear HTTP API SVG URL from explicit options.
 *
 * We do not set the HTTP `radius` query parameter so the asset stays a square viewport; rounding is applied in CSS on the `<img>`.
 */
export function buildDicebearAvatarUrl({
  style,
  seed,
  eyes,
  mouth,
  eyebrows,
  backgroundColor,
  backgroundType,
  textColor,
  flip,
  rotate,
  size = 128,
}: BuildDicebearUrlParams): string {
  const search = new URLSearchParams()
  search.set("seed", seed)
  search.set("size", String(size))

  if (style === "initials") {
    if (textColor) {
      const tc = textColor.replace(/^#/, "").toLowerCase()
      if (/^[a-f0-9]{6}$/.test(tc)) search.set("textColor", tc)
    }
  } else if (style === "avataaars-neutral") {
    if (eyebrows) search.set("eyebrows", eyebrows)
    if (eyes) search.set("eyes", eyes)
    if (mouth) search.set("mouth", mouth)
  } else {
    if (eyes) search.set("eyes", eyes)
    if (mouth) search.set("mouth", mouth)
  }

  if (backgroundColor) {
    const normalised = backgroundColor.replace(/^#/, "").toLowerCase()
    if (/^[a-f0-9]{6}$/.test(normalised)) search.set("backgroundColor", normalised)
  }
  if (backgroundType) search.set("backgroundType", backgroundType)
  if (flip === true) search.set("flip", "true")
  if (typeof rotate === "number" && !Number.isNaN(rotate) && rotate !== 0)
    search.set("rotate", String(rotate))

  const query = search.toString()
  return `${DICEBEAR_API_VERSION_BASE}/${style}/svg?${query}`
}

/**
 * Reads and normalises custom DiceBear settings from Supabase `user_metadata`.
 */
export function parseDicebearAvatarFromMetadata({
  userMetadata,
}: {
  userMetadata: Record<string, unknown>
}): DicebearAvatarStored | null {
  const raw = userMetadata.dicebear_avatar
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.custom !== true) {
    if (o.custom === false) return { custom: false }
    return null
  }

  if (!isDicebearStyle(o.style)) return null
  const style = o.style

  const seed = typeof o.seed === "string" ? o.seed : undefined
  const eyes = typeof o.eyes === "string" ? o.eyes : undefined
  const mouth = typeof o.mouth === "string" ? o.mouth : undefined
  const eyebrows = typeof o.eyebrows === "string" ? o.eyebrows : undefined
  const backgroundColor = typeof o.backgroundColor === "string" ? o.backgroundColor : undefined
  const textColor = typeof o.textColor === "string" ? o.textColor : undefined
  const backgroundType =
    o.backgroundType === "gradientLinear" || o.backgroundType === "solid"
      ? o.backgroundType
      : undefined
  const flip = o.flip === true
  const rotate = typeof o.rotate === "number" ? o.rotate : undefined

  return {
    custom: true,
    style,
    seed,
    eyes,
    mouth,
    eyebrows,
    backgroundColor,
    backgroundType,
    textColor,
    flip,
    rotate,
  }
}

/**
 * Resolves the avatar image URL for UI: saved DiceBear custom, otherwise email-seeded bottts-neutral.
 */
export function getResolvedAvatarUrl({
  email,
  userMetadata,
}: {
  email: string
  userMetadata: Record<string, unknown>
}): string {
  const stored = parseDicebearAvatarFromMetadata({ userMetadata })

  if (stored?.custom === true && stored.style) {
    return buildDicebearAvatarUrl({
      style: stored.style,
      seed: stored.seed?.trim() || email || "user",
      eyes: stored.eyes,
      mouth: stored.mouth,
      eyebrows: stored.eyebrows,
      backgroundColor: stored.backgroundColor,
      backgroundType: stored.backgroundType,
      textColor: stored.textColor,
      flip: stored.flip,
      rotate: stored.rotate,
    })
  }

  return buildDicebearAvatarUrl({
    style: "bottts-neutral",
    seed: email || "user",
  })
}

/**
 * Convenience helper for Supabase auth user objects.
 */
export function getResolvedAvatarUrlForAuthUser({ user }: { user: User }): string {
  return getResolvedAvatarUrl({
    email: user.email ?? "",
    userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  })
}
