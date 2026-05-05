import { NextResponse } from "next/server";
import { saveMemory } from "@/lib/memories/memory-service";
import { MEMORY_TYPES } from "@/lib/memories/types";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 200);

  let requestBuilder = supabase
    .from("memories")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status) {
    requestBuilder = requestBuilder.eq("status", status);
  }

  if (query) {
    const escaped = query.replace(/[%_,]/g, "");
    requestBuilder = requestBuilder.or(
      `key.ilike.%${escaped}%,content.ilike.%${escaped}%,type.ilike.%${escaped}%`
    );
  }

  const { data, error } = await requestBuilder;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memories: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  type PostBody = {
    type?: string;
    key?: string;
    content?: string;
    importance?: number;
    confidence?: number;
    source?: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
  };

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const type = body.type?.trim() ?? "user";
  if (!MEMORY_TYPES.includes(type as never)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${MEMORY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const memory = await saveMemory({
    supabase,
    userId: user.id,
    type: type as never,
    key: body.key?.trim() || body.content.trim().slice(0, 80),
    content: body.content.trim(),
    importance: body.importance ?? 0.8,
    confidence: body.confidence ?? 0.9,
    source: body.source ?? "manual",
    sourceMessageId: null,
    expiresAt: body.expiresAt ?? null,
    metadata: body.metadata ?? {},
  });

  if (!memory) {
    return NextResponse.json({ error: "Failed to save memory" }, { status: 500 });
  }

  return NextResponse.json(memory, { status: 201 });
}
