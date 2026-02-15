import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const circleId = searchParams.get("circleId");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  let query = supabase
    .from("posts")
    .select("*, author:users!posts_author_id_fkey(*), circle:circles(*), media(*)")
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (circleId) {
    query = query.eq("circle_id", circleId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { content, circleId, visibility, mediaIds } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (content.length > 2500) {
    return NextResponse.json({ error: "Content exceeds 2500 characters" }, { status: 400 });
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      content: content.trim(),
      circle_id: circleId || null,
      visibility: visibility || "circle",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(post, { status: 201 });
}
