import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { follower_id, action } = await request.json();
  if (!follower_id || !["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "reject") {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", follower_id)
      .eq("following_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("follows")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("follower_id", follower_id)
    .eq("following_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  await supabase.from("notifications").insert({
    user_id: follower_id,
    type: "follow_accepted",
    title: "Follow request accepted",
    body: `${profile?.display_name || "Someone"} accepted your follow request`,
    link: `/${profile?.username}`,
  });

  return NextResponse.json({ success: true });
}
