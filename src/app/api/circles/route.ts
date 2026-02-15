import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, prizeDescription } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: circle, error } = await supabase
    .from("circles")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      prize_description: prizeDescription?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-add creator as admin
  await supabase
    .from("circle_memberships")
    .insert({ circle_id: circle.id, user_id: user.id, role: "admin" });

  return NextResponse.json(circle, { status: 201 });
}
