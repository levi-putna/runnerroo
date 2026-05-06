import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Fetches one approval owned by the signed-in user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const { data: approval, error } = await supabase
    .from("workflow_approvals")
    .select("*, workflows(name)")
    .eq("id", approvalId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ approval })
}
