import { NextResponse } from "next/server";
import { deleteMemory, updateMemory } from "@/lib/memories/memory-service";
import { purgeMemoryReferencesFromUserConversations } from "@/lib/memories/purge-memory-references-from-conversations";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  type PatchBody = {
    content?: string;
    importance?: number;
    confidence?: number;
  };

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Updated content is required" }, { status: 400 });
  }

  const memory = await updateMemory({
    supabase,
    userId: user.id,
    memoryId: id,
    content: body.content,
    importance: body.importance ?? 0.8,
    confidence: body.confidence ?? 0.9,
    reason: "api_patch",
  });

  if (!memory) {
    return NextResponse.json({ error: "Memory not found or update failed" }, { status: 404 });
  }

  return NextResponse.json(memory);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await deleteMemory({
    supabase,
    userId: user.id,
    memoryId: id,
    reason: "api_delete",
    permanent: true,
  });

  await purgeMemoryReferencesFromUserConversations({
    supabase,
    userId: user.id,
    memoryId: id,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
