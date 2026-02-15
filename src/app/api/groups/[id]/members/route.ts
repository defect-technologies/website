import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!group || group.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, users(*)")
    .eq("group_id", id);

  return NextResponse.json(members || []);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!group || group.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: id, user_id: userId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!group || group.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
