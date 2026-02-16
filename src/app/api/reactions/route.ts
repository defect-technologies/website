import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, type } = await request.json();

  if (!postId || !type) {
    return NextResponse.json({ error: "postId and type are required" }, { status: 400 });
  }

  if (!["thumbsup", "heart", "thumbsdown"].includes(type)) {
    return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.type === type) {
      await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      return NextResponse.json({ action: "removed" });
    } else {
      await supabase
        .from("reactions")
        .update({ type })
        .eq("post_id", postId)
        .eq("user_id", user.id);
      return NextResponse.json({ action: "changed", type });
    }
  }

  await supabase
    .from("reactions")
    .insert({ post_id: postId, user_id: user.id, type });

  if (type === "thumbsdown") {
    const { data: downvotes } = await supabase
      .from("reactions")
      .select("user_id")
      .eq("post_id", postId)
      .eq("type", "thumbsdown");

    if ((downvotes?.length || 0) >= 3) {
      await supabase
        .from("posts")
        .update({ is_flagged: true, flag_count: downvotes!.length })
        .eq("id", postId);
    }
  }

  if (type === "thumbsup" || type === "heart") {
    await createReactionNotification(supabase, postId, user.id);
  }

  return NextResponse.json({ action: "added", type });
}

async function createReactionNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  reactorId: string
) {
  const { data: post } = await supabase
    .from("posts")
    .select("author_id,content")
    .eq("id", postId)
    .single();

  if (!post || post.author_id === reactorId) return;

  const { data: reactor } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", reactorId)
    .single();

  const { count: totalPositive } = await supabase
    .from("reactions")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId)
    .in("type", ["thumbsup", "heart"]);

  const { data: existingNotif } = await supabase
    .from("notifications")
    .select("id")
    .eq("related_post_id", postId)
    .eq("type", "reaction")
    .eq("user_id", post.author_id)
    .eq("read", false)
    .single();

  const count = totalPositive || 1;
  const title = count === 1
    ? `${reactor?.display_name || "Someone"} reacted to your post`
    : `${count} people reacted to your post`;
  const body = count === 1
    ? `${post.content.substring(0, 50).trimEnd()}${post.content.length > 50 ? "..." : ""}`
    : `Your post is getting attention!`;

  if (existingNotif) {
    await supabase
      .from("notifications")
      .update({ title, body, created_at: new Date().toISOString() })
      .eq("id", existingNotif.id);
  } else {
    await supabase.from("notifications").insert({
      user_id: post.author_id,
      type: "reaction",
      title,
      body,
      link: `/post/${postId}`,
      related_post_id: postId,
    });
  }
}
