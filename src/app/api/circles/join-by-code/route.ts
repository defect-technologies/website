import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const { data: circle } = await supabase
    .from("circles")
    .select("id, name")
    .eq("invite_code", code.trim().toLowerCase())
    .single();

  if (!circle) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("circle_memberships")
    .select("circle_id")
    .eq("circle_id", circle.id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already a member", circle }, { status: 409 });
  }

  const { error } = await supabase
    .from("circle_memberships")
    .insert({ circle_id: circle.id, user_id: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, circle });
}
