import { redirect } from "next/navigation"

/**
 * Legacy sidebar path — canonical runs hub lives at `/run`.
 */
export default function RunsAliasRedirectPage() {
  redirect("/run")
}
