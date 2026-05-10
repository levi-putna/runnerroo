import type { Page } from "@playwright/test"

/**
 * Reads Supabase GoTrue `user.id` from browser `localStorage` (SSR client persistence shape).
 */
export async function getAuthUserIdFromBrowserStorage({ page }: { page: Page }) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.includes("auth-token")) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as {
          user?: { id?: string }
          currentSession?: { user?: { id?: string } }
        }
        const id = parsed?.user?.id ?? parsed?.currentSession?.user?.id
        if (id) return id
      } catch {
        // Continue scanning other keys.
      }
    }
    return null as string | null
  })
}
