import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: circleId } = await params;
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: membership } = await supabase
    .from("circle_memberships")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "You must be a member of this circle" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("circle_memberships")
    .select("user_id")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  const { error } = await supabase
    .from("circle_memberships")
    .insert({ circle_id: circleId, user_id: userId, role: "member" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: circle } = await supabase
    .from("circles")
    .select("name")
    .eq("id", circleId)
    .single();

  const { data: inviter } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "invite",
    title: "You've been added to a circle",
    body: `${inviter?.display_name || "Someone"} added you to ${circle?.name || "a circle"}`,
    link: `/c/${circleId}`,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
