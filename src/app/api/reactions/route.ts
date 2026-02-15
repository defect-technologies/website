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

  // Check if user already reacted
  const { data: existing } = await supabase
    .from("reactions")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.type === type) {
      // Remove reaction (toggle off)
      await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      return NextResponse.json({ action: "removed" });
    } else {
      // Change reaction
      await supabase
        .from("reactions")
        .update({ type })
        .eq("post_id", postId)
        .eq("user_id", user.id);
      return NextResponse.json({ action: "changed", type });
    }
  }

  // New reaction
  await supabase
    .from("reactions")
    .insert({ post_id: postId, user_id: user.id, type });

  // Check for auto-flagging (3+ thumbsdown)
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

  return NextResponse.json({ action: "added", type });
}
