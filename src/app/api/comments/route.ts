import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Comment } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, content, visibility = "author_only" } = await request.json();

  if (!postId || !content?.trim()) {
    return NextResponse.json({ error: "postId and content are required" }, { status: 400 });
  }

  if (content.length > 300) {
    return NextResponse.json({ error: "Comment exceeds 300 characters" }, { status: 400 });
  }

  if (!["author_only", "public"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: user.id, content: content.trim(), visibility })
    .select("*, author:users(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  const { searchParams } = request.nextUrl;
  const postId = searchParams.get("postId");

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  const postAuthorId = post?.author_id;

  const { data, error } = await supabase
    .from("comments")
    .select("*, author:users(*)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data as Comment[]).filter((c) =>
    c.visibility === "public" ||
    c.author_id === currentUserId ||
    currentUserId === postAuthorId
  );

  return NextResponse.json(filtered);
}
