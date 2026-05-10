import { AssistantSettingsPanel } from "@/components/settings/assistant-settings-panel"
import { getAssistantSettings } from "@/lib/assistant-settings/assistant-settings-service"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/**
 * Assistant settings: role, voice and tone, things to never say,
 * recommendation style, default output format, and clarification behaviour.
 */
export default async function AssistantSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const settings = await getAssistantSettings({ supabase, userId: user.id })

  return <AssistantSettingsPanel initialSettings={settings} className="w-full" />
}
