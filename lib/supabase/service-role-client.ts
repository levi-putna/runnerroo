import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/**
 * Server-only Supabase client using the **service_role** JWT — bypasses RLS when persisting workflows
 * and runs invoked by trusted infrastructure (cron dispatch, migrations tooling, etc.).
 */
export function createServiceRoleSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for service role operations.")
  }
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
