import { createClient } from "@/lib/supabase/server"

/**
 * Creates a short-lived signed URL for a user-owned artefact.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: artefact, error: artefactError } = await supabase
    .from("user_files")
    .select("id, user_id, bucket, path")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (artefactError) {
    return new Response(JSON.stringify({ error: artefactError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!artefact) {
    return new Response(JSON.stringify({ error: "Artefact not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: signedData, error: signedError } = await supabase
    .storage
    .from(artefact.bucket as string)
    .createSignedUrl(artefact.path as string, 3600)

  if (signedError || !signedData?.signedUrl) {
    return new Response(JSON.stringify({ error: "Could not create signed URL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ url: signedData.signedUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
