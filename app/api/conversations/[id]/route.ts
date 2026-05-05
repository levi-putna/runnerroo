import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import {
  deriveSidebarMemoryPreviewFromMessages,
  mergeSidebarMemoryPreviewRows,
  parseSidebarPreviewPayload,
} from "@/lib/conversations/sidebar-memory-preview";
import { createClient } from "@/lib/supabase/server";

type PutBody = {
  messages: UIMessage[];
  title?: string;
};

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
    .from("conversations")
    .select("id, title, created_at, updated_at, memories_preview, messages")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
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

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];

  // Use the explicitly provided title (AI-generated) or fall back to truncating the
  // first user message. 60 characters matches the client-side AI title limit.
  const title =
    body.title?.trim() ||
    (() => {
      const firstUser = messages.find((m) => m.role === "user");
      const text = firstUser?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join(" ")
        .slice(0, 60);
      return text || "New conversation";
    })();

  // Merge memories_preview
  const { data: existing } = await supabase
    .from("conversations")
    .select("memories_preview")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const fromMessages = deriveSidebarMemoryPreviewFromMessages(messages);
  const existingPreview = parseSidebarPreviewPayload(existing?.memories_preview ?? []);
  const memoriesPreview = mergeSidebarMemoryPreviewRows(existingPreview, fromMessages);

  const { error } = await supabase.from("conversations").upsert(
    {
      id,
      user_id: user.id,
      title,
      messages,
      memories_preview: memoriesPreview,
    },
    { onConflict: "id", ignoreDuplicates: false }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
