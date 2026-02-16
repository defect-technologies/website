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

  await createCommentNotification(supabase, postId, user.id, content.trim());

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

async function createCommentNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  commenterId: string,
  commentContent: string
) {
  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id === commenterId) return;

  const { data: commenter } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", commenterId)
    .single();

  const { count: totalComments } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  const { data: existingNotif } = await supabase
    .from("notifications")
    .select("id")
    .eq("related_post_id", postId)
    .eq("type", "comment")
    .eq("user_id", post.author_id)
    .eq("read", false)
    .single();

  const count = totalComments || 1;
  const title = count === 1
    ? `${commenter?.display_name || "Someone"} commented on your post`
    : `${count} people commented on your post`;
  const body = count === 1
    ? `${commentContent.substring(0, 50).trimEnd()}${commentContent.length > 50 ? "..." : ""}`
    : "Your post is getting comments";

  if (existingNotif) {
    await supabase
      .from("notifications")
      .update({ title, body, created_at: new Date().toISOString() })
      .eq("id", existingNotif.id);
  } else {
    await supabase.from("notifications").insert({
      user_id: post.author_id,
      type: "comment",
      title,
      body,
      link: `/post/${postId}`,
      related_post_id: postId,
    });
  }
}
