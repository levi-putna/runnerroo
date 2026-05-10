/**
 * Mailpit REST helpers for local Supabase email capture (Inbucket-compatible port in `supabase/config.toml`).
 */

type MailpitMessageSummary = {
  ID: string
  To?: unknown
  Subject?: string
}

/**
 * Returns whether a Mailpit summary row targets the given mailbox (handles string or object `To` shapes).
 */
function messageTargetsEmail({ message, email }: { message: MailpitMessageSummary; email: string }) {
  const target = email.trim().toLowerCase()
  const { To } = message
  if (To == null) return false
  if (typeof To === "string") return To.toLowerCase().includes(target)
  if (!Array.isArray(To)) return false
  const fromList = To.some((entry) => {
    if (typeof entry === "string") return entry.toLowerCase().includes(target)
    if (entry && typeof entry === "object" && "Address" in entry) {
      return String((entry as { Address?: string }).Address ?? "")
        .toLowerCase()
        .includes(target)
    }
    return false
  })
  if (fromList) return true
  /** Last resort: some Mailpit builds embed recipients only in serialised metadata. */
  return JSON.stringify(message).toLowerCase().includes(target)
}

type MailpitMessagesResponse = {
  messages?: MailpitMessageSummary[]
  Messages?: MailpitMessageSummary[]
  total?: number
}

function mailpitBaseUrl() {
  const base =
    process.env.MAILPIT_BASE_URL ?? process.env.NEXT_PUBLIC_MAILPIT_URL ?? "http://127.0.0.1:54324"
  return base.replace(/\/$/, "")
}

/**
 * Normalises Mailpit list payloads across minor API differences.
 */
function messagesFromListPayload(data: MailpitMessagesResponse): MailpitMessageSummary[] {
  const raw = data.messages ?? data.Messages
  return Array.isArray(raw) ? raw : []
}

/**
 * Whether serialised message JSON references the mailbox (covers odd recipient serialisation).
 */
function jsonBodyContainsRecipientEmail({ body, email }: { body: unknown; email: string }) {
  const target = email.trim().toLowerCase()
  if (!target) return false
  try {
    return JSON.stringify(body).toLowerCase().includes(target)
  } catch {
    return false
  }
}

/**
 * Loads a full Mailpit message and checks whether it is addressed to `email`.
 */
async function fullMailpitMessageTargetsRecipient({ id, email }: { id: string; email: string }) {
  const res = await fetch(`${mailpitBaseUrl()}/api/v1/message/${id}`)
  if (!res.ok) return false
  const body = (await res.json()) as MailpitMessageSummary & Record<string, unknown>
  if (messageTargetsEmail({ message: body, email })) return true
  return jsonBodyContainsRecipientEmail({ body, email })
}

/**
 * Removes every captured message so parallel specs do not read stale mail.
 */
export async function deleteAllMailpitMessages() {
  const res = await fetch(`${mailpitBaseUrl()}/api/v1/messages`, { method: "DELETE" })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Mailpit delete all failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Fetches full message HTML/text for OTP and link extraction.
 */
export async function fetchMailpitMessageHtml({ id }: { id: string }) {
  const res = await fetch(`${mailpitBaseUrl()}/api/v1/message/${id}`)
  if (!res.ok) {
    throw new Error(`Mailpit fetch message ${id}: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { HTML?: string; Text?: string }
  return body.HTML ?? body.Text ?? ""
}

/**
 * Polls until a message whose recipients include `email` appears, then returns its id.
 */
export async function waitForMessageToRecipient({
  email,
  timeoutMs = 45_000,
  pollMs = 400,
}: {
  email: string
  timeoutMs?: number
  pollMs?: number
}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${mailpitBaseUrl()}/api/v1/messages?limit=200`)
    if (!res.ok) {
      throw new Error(`Mailpit list messages: ${res.status} ${await res.text()}`)
    }
    const data = (await res.json()) as MailpitMessagesResponse
    const rows = messagesFromListPayload(data)
    for (const m of rows) {
      if (!m?.ID) continue
      if (messageTargetsEmail({ message: m, email })) return m.ID
      /** Some Mailpit builds omit usable `To` on the list row; the full payload is authoritative. */
      if (await fullMailpitMessageTargetsRecipient({ id: m.ID, email })) return m.ID
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error(`Timed out waiting for Mailpit message to ${email}`)
}

/**
 * Extracts the six-digit Supabase email OTP from rendered template HTML.
 */
export function extractEmailOtpFromMailpitHtml({ html }: { html: string }) {
  const matches = [...html.matchAll(/\b(\d{6})\b/g)].map((m) => m[1])
  if (matches.length === 0) {
    throw new Error("No 6-digit OTP found in Mailpit message HTML")
  }
  /** Prefer the last six-digit group (templates sometimes repeat numbers in URLs). */
  return matches[matches.length - 1]!
}

/**
 * Decodes entities in Mailpit `href` values so `token&type&redirect_to` query strings survive for `page.goto`.
 */
function decodeMailpitHrefUrl({ raw }: { raw: string }) {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

/**
 * Returns the first magic-link style URL from HTML or text (GoTrue verify endpoint, app confirm/callback, or implicit hash).
 */
export function extractMagicLinkUrl({
  htmlOrText,
  appOrigin,
}: {
  htmlOrText: string
  appOrigin: string
}) {
  const origin = appOrigin.replace(/\/$/, "")
  /** Local confirmation emails link to GoTrue verify (`/auth/v1/verify?...`) with HTML-encoded `&`. */
  const verifyRegex = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/gi
  const verifyHit = htmlOrText.match(verifyRegex)
  if (verifyHit?.[0]) return decodeMailpitHrefUrl({ raw: verifyHit[0] })

  const hrefRegex = new RegExp(
    `https?:\\/\\/[^\\s"'<>]+(?:\\/auth\\/(?:callback|confirm)[^\\s"'<>]*)`,
    "gi"
  )
  const fromHref = htmlOrText.match(hrefRegex)
  if (fromHref?.[0]) {
    const u = decodeMailpitHrefUrl({ raw: fromHref[0] })
    if (u.includes("/auth/callback") || u.includes("/auth/confirm")) return u
  }
  /** Fragment-style implicit links sometimes appear in HTML-encoded attributes. */
  const fragment = htmlOrText.match(/#access_token=[^&\s"'<>]+/i)
  if (fragment) {
    return `${origin}/login${fragment[0]}`
  }
  return null
}
