import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check circle exists
  const { data: circle } = await supabase
    .from("circles")
    .select("id")
    .eq("id", id)
    .single();

  if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 });

  // Check if already a member
  const { data: existing } = await supabase
    .from("circle_memberships")
    .select("user_id")
    .eq("circle_id", id)
    .eq("user_id", user.id)
    .single();

  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const { error } = await supabase
    .from("circle_memberships")
    .insert({ circle_id: id, user_id: user.id, role: "member" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
