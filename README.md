This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run the development server (this repo uses **port 80** by default):

```bash
yarn dev
```

Open [http://127.0.0.1:80](http://127.0.0.1:80) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimise and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing

Automated regressions live in **[Playwright](https://playwright.dev/)** **end-to-end** specs against a **real local stack**: the Next.js app, **[Supabase](https://supabase.com/)** CLI, and **[Mailpit](https://mailpit.axllent.org/)** for auth emails.

### Prerequisites

1. **`yarn`** (not npm — project convention).
2. **Environment** — duplicate **`.env.local`** from your normal dev setup; copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus any vars the app expects. Tests also read **`.env.playwright.example`** (see repo root after implementation) — add local overrides in **`.env.playwright.local`** (gitignored): point **`NEXT_PUBLIC_*`** keys at **`http://127.0.0.1:<api-port>`** from `yarn sb:status`; set **`MAILPIT_BASE_URL`** to the SMTP capture UI (**default `http://127.0.0.1:54324`** unless `[inbucket]` is reconfigured).
3. **Supabase CLI** running — **`yarn sb:start`** (or **`supabase start`**) against this repo [`supabase/config.toml`](supabase/config.toml).
4. **Development server** — **`yarn dev`** serves on **port 80** by default (**`next dev --port 80`**). Playwright uses **`reuseExistingServer`** locally so leaving dev running separately is OK.
5. **Browsers once** — after adding Playwright dependency: **`yarn playwright install`** (Chromium suffices for Phase 1).

### How runs work

- **`playwright.config.ts`** anchors **`baseURL`** to **`http://127.0.0.1:80`** and may start **`yarn dev`** automatically in CI-only paths.
- Mail flows (**magic link OTP**, signup PIN, optional password **`reauthenticate`**) — polls Mailpit **`/api/v1`** REST helpers under **`tests/`**; specs never scrape production inboxes.
- **Identity collisions** prevented via **`createEphemeralAuthIdentity()`** (cryptographic random slug + worker index) so **`auth.users`** and Mailpit stay isolated across repeated runs **without running `yarn sb:reset`.**
- **Tags / projects**: auth smoke (**default** profile) vs **`@profile-secondary`** gated suites exercising [`/app/settings/profile`](app/app/settings/profile/page.tsx).

### Commands

```bash
yarn playwright install           # First machine only

yarn sb:status                   # Confirm API + Mailpit ports

yarn test:e2e                    # Headless Chromium suite

yarn test:e2e:ui                 # Playwright Inspector / trace-friendly

yarn test:e2e --grep "@oauth"    # OAuth placeholders (`test.fixme`)

yarn test:e2e --grep "A1:"       # Single auth scenario (colon avoids matching A10/A11/A12)
```

### Layout (after implementation)

- **`playwright.config.ts`** — timeouts, **`webServer`**, env injection.
- **`tests/e2e/*.spec.ts`** — scenario files (**auth**, **profile**).
- **`tests/helpers/mailpit.ts`** — poll / delete inbox, parse OTP and magic‑link URLs.
- **`tests/helpers/test-identity.ts`** — ephemeral emails + names.
- **`tests/helpers/nav-user.ts`** (optional fixture) — asserts sidebar footer/menu name + email parity.
- **`.env.playwright.example`** — documented template for Mailpit URL + anon keys (**no secrets**).

### Adding a new automated test

1. **Prefer** **`tests/e2e/<area>.spec.ts`** or extend an existing **`describe`**; keep Mailpit-heavy flows **serial** (`test.describe.configure({ mode: "serial" })`) when they share **`deleteAll`** timing.
2. **Never hard‑code identities** — import **`createEphemeralAuthIdentity({ parallelIndex })`** from helpers.
3. **Stable selectors** — add **`data-testid`** to new UI seams (auth cards, profile save actions, **`NavUser`** footer vs dropdown lines) rather than brittle CSS nth‑child hacks.
4. **Mailpit** — use **`waitForMessageToRecipient`** matching the **fixture email** substring; OTP regex expects **six digits** emitted by templates under [`supabase/templates/`](supabase/templates/).
5. **`expectNavMatchesSession`** — after **`full_name`/avatar/password** edits, reopen account menu verifying **duplicate label rows** (**footer collapse + dropdown header**) until **`NavUser` session sync** refactor lands (**`page.reload()`** documented fallback).
6. **Third‑party OAuth** — retain **`describe.skip`** or **`test.fixme`** on **`@oauth`** specs until Marketplace test apps exist.
